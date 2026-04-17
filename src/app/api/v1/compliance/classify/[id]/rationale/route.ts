import { type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/errors";
import { ErrorCodes } from "@/lib/error-codes";
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
      return errorResponse({
        code: auth.code,
        message: auth.message,
        status: auth.status,
        requestId,
      });
    }
    workspaceId = auth.workspaceId;
    keyPrefix = auth.keyPrefix;

    const record = await prisma.classificationRecord.findUnique({
      where: { id },
    });
    if (!record || record.workspaceId !== workspaceId) {
      statusCode = 404;
      return errorResponse({
        code: ErrorCodes.NOT_FOUND,
        message: "Classification record not found",
        status: 404,
        requestId,
      });
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
      return errorResponse({
        code: ErrorCodes.UPSTREAM_ERROR,
        message: "Rationale generation failed. Try again shortly.",
        status: 502,
        requestId,
      });
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
    return errorResponse({
      code: ErrorCodes.INTERNAL_ERROR,
      message,
      status: 500,
      requestId,
    });
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
