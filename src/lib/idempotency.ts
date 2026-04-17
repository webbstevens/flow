/**
 * Idempotency-key dedupe (VISION.md §4.2).
 *
 * Consumers send `Idempotency-Key: <token>` on writes; a retry with the
 * same key + body replays the stored response. Same key, different body
 * → 422. Same key, still in-flight → 409. Missing header → pass-through.
 *
 * Only 2xx and 4xx responses are stored. 5xx responses delete the lock
 * so the client can retry.
 */

import { createHash } from "crypto";
import { prisma } from "./prisma";
import { errorResponse } from "./errors";
import { ErrorCodes } from "./error-codes";

const TTL_MS = 24 * 60 * 60 * 1000;
const MAX_KEY_LENGTH = 255;

export const IDEMPOTENCY_HEADER = "idempotency-key";
export const REPLAYED_HEADER = "Idempotent-Replayed";

export interface IdempotencyContext {
  workspaceId: string;
  method: string;
  path: string;
  key: string;
  requestBody: string;
  requestId: string;
}

/**
 * Attempt to acquire the idempotency lock. Returns:
 *   - { kind: "fresh" }           caller should run the handler
 *   - { kind: "replay", response } caller should return this response
 *   - { kind: "error", response }  caller should return this response
 */
export async function acquireIdempotencyLock(
  ctx: IdempotencyContext,
): Promise<
  | { kind: "fresh" }
  | { kind: "replay"; response: Response }
  | { kind: "error"; response: Response }
> {
  if (ctx.key.length === 0 || ctx.key.length > MAX_KEY_LENGTH) {
    return {
      kind: "error",
      response: errorResponse({
        code: ErrorCodes.VALIDATION_ERROR,
        message: `Idempotency-Key must be 1-${MAX_KEY_LENGTH} chars`,
        status: 400,
        requestId: ctx.requestId,
      }),
    };
  }

  const requestHash = sha256(ctx.requestBody);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + TTL_MS);

  try {
    await prisma.idempotencyKey.create({
      data: {
        workspaceId: ctx.workspaceId,
        method: ctx.method,
        path: ctx.path,
        key: ctx.key,
        requestHash,
        lockedAt: now,
        expiresAt,
      },
    });
    return { kind: "fresh" };
  } catch (err) {
    if (!isUniqueConstraintError(err)) throw err;
  }

  const existing = await prisma.idempotencyKey.findUnique({
    where: {
      workspaceId_method_path_key: {
        workspaceId: ctx.workspaceId,
        method: ctx.method,
        path: ctx.path,
        key: ctx.key,
      },
    },
  });

  if (!existing) {
    // Race: row was deleted between conflict and read. Treat as fresh.
    return { kind: "fresh" };
  }

  if (existing.requestHash !== requestHash) {
    return {
      kind: "error",
      response: errorResponse({
        code: ErrorCodes.IDEMPOTENCY_CONFLICT,
        message:
          "Idempotency-Key was reused with a different request body. Use a new key or send the original body.",
        status: 422,
        requestId: ctx.requestId,
      }),
    };
  }

  if (existing.completedAt && existing.statusCode != null) {
    return { kind: "replay", response: buildReplayResponse(existing, ctx.requestId) };
  }

  return {
    kind: "error",
    response: errorResponse({
      code: ErrorCodes.IDEMPOTENCY_IN_PROGRESS,
      message: "A request with this Idempotency-Key is already in progress.",
      status: 409,
      requestId: ctx.requestId,
    }),
  };
}

/**
 * Persist a completed response under the idempotency key, or clear the
 * lock on 5xx so the client can retry.
 */
export async function finalizeIdempotencyLock(
  ctx: IdempotencyContext,
  response: Response,
): Promise<Response> {
  const where = {
    workspaceId_method_path_key: {
      workspaceId: ctx.workspaceId,
      method: ctx.method,
      path: ctx.path,
      key: ctx.key,
    },
  } as const;

  if (response.status >= 500) {
    await prisma.idempotencyKey.delete({ where }).catch(() => {
      /* already gone — fine */
    });
    return response;
  }

  const [bodyText, headers] = await readBodyAndHeaders(response);

  await prisma.idempotencyKey
    .update({
      where,
      data: {
        statusCode: response.status,
        responseBody: bodyText,
        responseHeaders: headers,
        completedAt: new Date(),
      },
    })
    .catch(() => {
      /* best-effort; retry on the next call will hit the lock path */
    });

  return new Response(bodyText, {
    status: response.status,
    headers: response.headers,
  });
}

function buildReplayResponse(
  existing: {
    statusCode: number | null;
    responseBody: unknown;
    responseHeaders: unknown;
  },
  requestId: string,
): Response {
  const status = existing.statusCode ?? 200;
  const headers = new Headers();
  if (existing.responseHeaders && typeof existing.responseHeaders === "object") {
    for (const [k, v] of Object.entries(
      existing.responseHeaders as Record<string, string>,
    )) {
      headers.set(k, v);
    }
  }
  headers.set(REPLAYED_HEADER, "true");
  headers.set("X-Request-Id", requestId);
  const body = typeof existing.responseBody === "string"
    ? existing.responseBody
    : JSON.stringify(existing.responseBody ?? null);
  return new Response(body, { status, headers });
}

async function readBodyAndHeaders(
  response: Response,
): Promise<[string, Record<string, string>]> {
  const bodyText = await response.text();
  const headers: Record<string, string> = {};
  response.headers.forEach((v, k) => {
    // Skip per-request headers that shouldn't be replayed
    if (k === "x-request-id" || k === "x-response-time") return;
    headers[k] = v;
  });
  return [bodyText, headers];
}

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

function isUniqueConstraintError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2002"
  );
}
