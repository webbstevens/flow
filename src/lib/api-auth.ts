import { prisma } from "./prisma";
import { hashApiKey } from "./api-keys";
import { errorResponse } from "./errors";
import { ErrorCodes, type ErrorCode } from "./error-codes";
import { getWorkspaceId } from "./session";
import { checkRateLimit } from "./rate-limit";

export class ApiKeyError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
  }
}

/**
 * Verify the Authorization header contains a valid, active API key.
 * Returns the ApiKey row (with workspaceId) on success.
 * Throws ApiKeyError on any failure — callers should catch and format.
 */
export async function requireApiKey(request: Request) {
  const header = request.headers.get("authorization");
  if (!header || !header.startsWith("Bearer ")) {
    throw new ApiKeyError(
      "Missing or invalid Authorization header. Expected: Bearer sk_flow_...",
      401
    );
  }

  const fullKey = header.slice("Bearer ".length).trim();
  if (!fullKey.startsWith("sk_flow_")) {
    throw new ApiKeyError("Invalid API key format", 401);
  }

  const prefix = fullKey.slice(0, 10);
  const keyHash = hashApiKey(fullKey);

  const apiKey = await prisma.apiKey.findFirst({
    where: { prefix, keyHash, revokedAt: null },
  });

  if (!apiKey) {
    throw new ApiKeyError("Invalid or revoked API key", 401);
  }

  // Update lastUsedAt without blocking the request
  prisma.apiKey
    .update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    })
    .catch(() => {
      /* non-critical */
    });

  return apiKey;
}

/**
 * Resolve the caller's workspace using either a Bearer API key (preferred
 * when the header is present) or the session cookie. Designed for routes
 * that want to accept both patterns — e.g. the audit endpoints, which are
 * called both by the /analytics UI (session) and by broker scripts (API key).
 *
 * Returns a result object so the caller can distinguish "no auth provided"
 * from "invalid API key" from "rate limited" and emit the right status code.
 */
export type CallerResolution =
  | { ok: true; workspaceId: string; keyPrefix: string | null }
  | {
      ok: false;
      status: number;
      code: ErrorCode;
      message: string;
      keyPrefix?: string | null;
    };

export async function resolveCallerWorkspace(
  request: Request,
): Promise<CallerResolution> {
  const header = request.headers.get("authorization");

  // API-key path: if an Authorization header is present, it must be valid.
  if (header) {
    try {
      const apiKey = await requireApiKey(request);
      const rl = checkRateLimit(apiKey.prefix);
      if (!rl.allowed) {
        return {
          ok: false,
          status: 429,
          code: ErrorCodes.RATE_LIMITED,
          message: "Rate limit exceeded. Max 10 requests per minute.",
          keyPrefix: apiKey.prefix,
        };
      }
      return {
        ok: true,
        workspaceId: apiKey.workspaceId,
        keyPrefix: apiKey.prefix,
      };
    } catch (err) {
      if (err instanceof ApiKeyError) {
        return {
          ok: false,
          status: err.status,
          code: ErrorCodes.UNAUTHORIZED,
          message: err.message,
        };
      }
      throw err;
    }
  }

  // Session path.
  const workspaceId = await getWorkspaceId();
  if (!workspaceId) {
    return {
      ok: false,
      status: 401,
      code: ErrorCodes.UNAUTHORIZED,
      message: "Authentication required",
    };
  }
  return { ok: true, workspaceId, keyPrefix: null };
}

/**
 * Wrap a route handler to require a valid API key.
 * Formats ApiKeyError -> standard error response.
 */
export function withApiKey<Ctx>(
  handler: (
    request: Request,
    ctx: Ctx,
    apiKey: Awaited<ReturnType<typeof requireApiKey>>
  ) => Promise<Response>
) {
  return async (request: Request, ctx: Ctx): Promise<Response> => {
    try {
      const apiKey = await requireApiKey(request);
      return await handler(request, ctx, apiKey);
    } catch (err) {
      if (err instanceof ApiKeyError) {
        return errorResponse({
          code: ErrorCodes.UNAUTHORIZED,
          message: err.message,
          status: err.status,
        });
      }
      throw err;
    }
  };
}
