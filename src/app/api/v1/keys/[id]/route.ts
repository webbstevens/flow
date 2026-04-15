import { type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/errors";
import { getWorkspaceId } from "@/lib/session";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const workspaceId = await getWorkspaceId();
    if (!workspaceId) {
      return errorResponse("No workspace session", 401);
    }

    const existing = await prisma.apiKey.findUnique({
      where: { id },
    });

    if (!existing || existing.workspaceId !== workspaceId) {
      return errorResponse("Key not found", 404);
    }
    if (existing.revokedAt) {
      return errorResponse("Key already revoked", 400);
    }

    await prisma.apiKey.update({
      where: { id },
      data: { revokedAt: new Date() },
    });

    return Response.json({ success: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return errorResponse(message, 500);
  }
}
