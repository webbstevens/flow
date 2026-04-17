import { type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/errors";
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

    const precedents = await getOrInferPrecedents({
      recordId: record.id,
      hsCode: record.hsCode,
      title: record.sourceTitle,
      materials: record.materials,
    });

    if (!precedents) {
      statusCode = 502;
      const res = errorResponse("Precedents lookup failed", 502);
      res.headers.set("X-Request-Id", requestId);
      return res;
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
    const res = errorResponse(message, 500);
    res.headers.set("X-Request-Id", requestId);
    return res;
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
