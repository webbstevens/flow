import { type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/errors";
import { generateRequestId, logRequest } from "@/lib/request-logger";
import { incrementUsage } from "@/lib/usage";
import { resolveCallerWorkspace } from "@/lib/api-auth";
import { getOrInferRationale } from "@/lib/rationale";

/**
 * GET /api/v1/compliance/classify/{id}/rationale
 *
 * Returns the GRI-step analysis + section/chapter note review that
 * supports the classification's HS code. Lazy — first call generates +
 * caches via Claude; subsequent calls (any record with the same HS10 and
 * normalized attribute set) hit the cached row.
 *
 * Accepts either a Bearer API key OR a logged-in session cookie. Ownership
 * is enforced: the record must belong to the caller's workspace.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = generateRequestId();
  const start = Date.now();
  let statusCode = 500;
  let errorMsg: string | undefined;
  let workspaceId: string | null = null;
  let keyPrefix: string | null = null;

  const { id } = await params;

  try {
    const auth = await resolveCallerWorkspace(request);
    if (!auth.ok) {
      statusCode = auth.status;
      keyPrefix = auth.keyPrefix ?? null;
      const res = errorResponse(auth.message, auth.status);
      res.headers.set("X-Request-Id", requestId);
      return res;
    }
    workspaceId = auth.workspaceId;
    keyPrefix = auth.keyPrefix;

    const record = await prisma.classificationRecord.findUnique({
      where: { id },
    });
    if (!record || record.workspaceId !== workspaceId) {
      statusCode = 404;
      const res = errorResponse("Classification record not found", 404);
      res.headers.set("X-Request-Id", requestId);
      return res;
    }

    const rationale = await getOrInferRationale({
      recordId: record.id,
      hsCode: record.hsCode,
      title: record.sourceTitle,
      materials: record.materials,
      customsDescription: record.customsDescription,
      category: null, // not persisted on the record today; hash still stable
    });

    if (!rationale) {
      statusCode = 502;
      const res = errorResponse(
        "Rationale generation failed. Try again shortly.",
        502,
      );
      res.headers.set("X-Request-Id", requestId);
      return res;
    }

    statusCode = 200;
    incrementUsage(workspaceId, "rationale");

    const res = Response.json({ status: "success", data: rationale });
    res.headers.set("X-Request-Id", requestId);
    return res;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Internal server error";
    errorMsg = message;
    const res = errorResponse(message, 500);
    res.headers.set("X-Request-Id", requestId);
    return res;
  } finally {
    logRequest({
      requestId,
      method: "GET",
      path: `/api/v1/compliance/classify/${id}/rationale`,
      statusCode,
      responseMs: Date.now() - start,
      keyPrefix,
      workspaceId,
      errorMsg,
    });
  }
}
