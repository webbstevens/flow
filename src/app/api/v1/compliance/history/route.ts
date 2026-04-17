import { type NextRequest } from "next/server";
import { errorResponse } from "@/lib/errors";
import { ErrorCodes } from "@/lib/error-codes";
import { prisma } from "@/lib/prisma";
import { getWorkspaceId } from "@/lib/session";
import { publicUrlForPath } from "@/lib/image-storage";
import { generateRequestId, logRequest } from "@/lib/request-logger";
import { buildClassificationEnvelope } from "@/lib/compliance";

export async function GET(request: NextRequest) {
  const requestId = generateRequestId();
  const start = Date.now();
  let statusCode = 500;
  let errorMsg: string | undefined;

  try {
    const workspaceId = await getWorkspaceId();
    if (!workspaceId) {
      statusCode = 200;
      const res = Response.json({
        data: [],
        pagination: { page: 1, limit: 0, total: 0 },
      });
      res.headers.set("X-Request-Id", requestId);
      return res;
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const limit = Math.min(
      100,
      Math.max(1, Number(searchParams.get("limit") ?? "20")),
    );

    const [rows, total] = await Promise.all([
      prisma.classificationRecord.findMany({
        where: { workspaceId },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.classificationRecord.count({ where: { workspaceId } }),
    ]);

    const data = rows.map((r) =>
      buildClassificationEnvelope({
        id: r.id,
        hsCode: r.hsCode,
        midCode: r.midCode,
        countryOfOrigin: r.countryOfOrigin,
        materials: r.materials,
        customsDescription: r.customsDescription,
        confidenceScore: r.confidenceScore,
        requiresReview: r.requiresReview,
        restrictedGoodsFlag: r.restrictedGoodsFlag,
        aiAttributes: (r.aiAttributes as Record<string, unknown> | null) ?? null,
        productUrl: r.productUrl,
        sourceTitle: r.sourceTitle,
        createdAt: r.createdAt,
        imageUrl: publicUrlForPath(r.imageStoragePath),
      }),
    );

    statusCode = 200;
    const res = Response.json({
      status: "success",
      data,
      pagination: { page, limit, total },
    });
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
      path: "/api/v1/compliance/history",
      statusCode,
      responseMs: Date.now() - start,
      errorMsg,
    });
  }
}
