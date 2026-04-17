import { type NextRequest } from "next/server";
import { ApiKeyError, requireApiKey } from "./api-auth";
import { errorResponse } from "./errors";
import { checkRateLimit } from "./rate-limit";
import { generateRequestId, logRequest } from "./request-logger";
import { incrementUsage } from "./usage";

interface ApiHandlerOptions {
  /** If true, require a valid API key (bearer auth). Default: false. */
  auth?: boolean;
  /** Usage metering endpoint label (e.g. "classify"). Omit to skip metering. */
  meter?: string;
}

/**
 * Wraps an API route handler with:
 * 1. X-Request-Id header on every response
 * 2. Bearer auth (optional)
 * 3. Rate limiting per API key (10/min)
 * 4. Request logging (fire-and-forget)
 * 5. Usage metering (fire-and-forget)
 */
export function apiHandler<Ctx>(
  options: ApiHandlerOptions,
  handler: (
    request: NextRequest,
    ctx: Ctx,
    meta: { requestId: string; keyPrefix?: string; workspaceId?: string }
  ) => Promise<Response>
) {
  return async (request: NextRequest, ctx: Ctx): Promise<Response> => {
    const requestId = generateRequestId();
    const start = Date.now();
    const path = request.nextUrl.pathname;
    const method = request.method;
    let keyPrefix: string | undefined;
    let workspaceId: string | undefined;
    let statusCode = 500;
    let errorMsg: string | undefined;

    try {
      // Auth
      if (options.auth) {
        const apiKey = await requireApiKey(request);
        keyPrefix = apiKey.prefix;
        workspaceId = apiKey.workspaceId;

        // Rate limit
        const rl = checkRateLimit(keyPrefix);
        if (!rl.allowed) {
          statusCode = 429;
          const res = errorResponse("Rate limit exceeded. Max 10 requests per minute.", 429);
          return addHeaders(res, requestId, rl.remaining, rl.resetMs);
        }
      }

      const response = await handler(request, ctx, {
        requestId,
        keyPrefix,
        workspaceId,
      });
      statusCode = response.status;

      // Meter successful requests
      if (options.meter && workspaceId && statusCode >= 200 && statusCode < 300) {
        incrementUsage(workspaceId, options.meter);
      }

      return addHeaders(response, requestId);
    } catch (err) {
      if (err instanceof ApiKeyError) {
        statusCode = err.status;
        errorMsg = err.message;
        return addHeaders(errorResponse(err.message, err.status), requestId);
      }
      const message =
        err instanceof Error ? err.message : "Internal server error";
      statusCode = 500;
      errorMsg = message;
      return addHeaders(errorResponse(message, 500), requestId);
    } finally {
      logRequest({
        requestId,
        method,
        path,
        statusCode,
        responseMs: Date.now() - start,
        keyPrefix,
        workspaceId,
        errorMsg,
      });
    }
  };
}

function addHeaders(
  response: Response,
  requestId: string,
  rateLimitRemaining?: number,
  rateLimitResetMs?: number
): Response {
  const headers = new Headers(response.headers);
  headers.set("X-Request-Id", requestId);
  headers.set("X-Response-Time", `${Date.now()}ms`);
  if (rateLimitRemaining !== undefined) {
    headers.set("X-RateLimit-Remaining", String(rateLimitRemaining));
  }
  if (rateLimitResetMs !== undefined) {
    headers.set("Retry-After", String(Math.ceil(rateLimitResetMs / 1000)));
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
