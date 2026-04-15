import { prisma } from "./prisma";
import { hashApiKey } from "./api-keys";
import { errorResponse } from "./errors";

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
        return errorResponse(err.message, err.status);
      }
      throw err;
    }
  };
}
