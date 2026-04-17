import { type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/errors";
import { ErrorCodes } from "@/lib/error-codes";
import { getWorkspaceId } from "@/lib/session";
import { generateRequestId } from "@/lib/request-logger";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = generateRequestId();
  try {
    const { id } = await params;
    const workspaceId = await getWorkspaceId();
    if (!workspaceId) {
      return errorResponse({
        code: ErrorCodes.UNAUTHORIZED,
        message: "No workspace session",
        status: 401,
        requestId,
      });
    }

    const existing = await prisma.apiKey.findUnique({
      where: { id },
    });

    if (!existing || existing.workspaceId !== workspaceId) {
      return errorResponse({
        code: ErrorCodes.NOT_FOUND,
        message: "Key not found",
        status: 404,
        requestId,
      });
    }
    if (existing.revokedAt) {
      return errorResponse({
        code: ErrorCodes.CONFLICT,
        message: "Key already revoked",
        status: 400,
        requestId,
      });
    }

    await prisma.apiKey.update({
      where: { id },
      data: { revokedAt: new Date() },
    });

    return Response.json({ success: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return errorResponse({
      code: ErrorCodes.INTERNAL_ERROR,
      message,
      status: 500,
      requestId,
    });
  }
}
