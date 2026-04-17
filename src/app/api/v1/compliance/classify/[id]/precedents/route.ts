import { type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/errors";
import { ErrorCodes } from "@/lib/error-codes";
import { generateRequestId, logRequest } from "@/lib/request-logger";
import { incrementUsage } from "@/lib/usage";
import { resolveCallerWorkspace } from "@/lib/api-auth";
import { getOrInferPrecedents } from "@/lib/precedents";

/**
 * GET /api/v1/compliance/classify/{id}/precedents
 *
 * Returns CROSS (CBP Rulings Online) precedent matches for the record's
 * HS code + product attributes. v1 is a stub: the shape is stable but the
 * rulings array is empty and a `notice` field explains the closed-beta
 * state. When the real fetcher ships, clients get populated rulings
 * without any shape changes.
 *
 * Accepts either a Bearer API key OR a logged-in session cookie.
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

    const precedents = await getOrInferPrecedents({
      recordId: record.id,
      hsCode: record.hsCode,
      title: record.sourceTitle,
      materials: record.materials,
    });

    if (!precedents) {
      statusCode = 502;
      return errorResponse({
        code: ErrorCodes.UPSTREAM_ERROR,
        message: "Precedents lookup failed",
        status: 502,
        requestId,
      });
    }

    statusCode = 200;
    incrementUsage(workspaceId, "precedents");

    const res = Response.json({ status: "success", data: precedents });
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
      path: `/api/v1/compliance/classify/${id}/precedents`,
      statusCode,
      responseMs: Date.now() - start,
      keyPrefix,
      workspaceId,
      errorMsg,
    });
  }
}
