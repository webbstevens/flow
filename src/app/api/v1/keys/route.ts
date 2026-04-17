import { type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/errors";
import { ErrorCodes } from "@/lib/error-codes";
import { generateApiKey, maskApiKey } from "@/lib/api-keys";
import { getOrCreateWorkspaceId } from "@/lib/session";
import { generateRequestId } from "@/lib/request-logger";

const createKeySchema = z.object({
  name: z.string().min(1).max(80),
});

export async function POST(request: NextRequest) {
  const requestId = generateRequestId();
  try {
    const workspaceId = await getOrCreateWorkspaceId();
    const body = await request.json();
    const parsed = createKeySchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse({
        code: ErrorCodes.VALIDATION_ERROR,
        message: parsed.error.issues[0].message,
        status: 400,
        requestId,
      });
    }

    const { fullKey, prefix, keyHash } = generateApiKey();

    const apiKey = await prisma.apiKey.create({
      data: {
        workspaceId,
        prefix,
        keyHash,
        name: parsed.data.name,
      },
      select: {
        id: true,
        prefix: true,
        name: true,
        createdAt: true,
      },
    });

    // full key returned ONCE, never retrievable again
    return Response.json(
      {
        ...apiKey,
        fullKey,
        note: "Save this key now — it will never be shown again.",
      },
      { status: 201 }
    );
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

export async function GET() {
  const requestId = generateRequestId();
  try {
    const workspaceId = await getOrCreateWorkspaceId();
    const keys = await prisma.apiKey.findMany({
      where: { workspaceId, revokedAt: null },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        prefix: true,
        name: true,
        lastUsedAt: true,
        createdAt: true,
      },
    });

    return Response.json({
      data: keys.map((k) => ({
        ...k,
        masked: maskApiKey(k.prefix),
      })),
    });
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
