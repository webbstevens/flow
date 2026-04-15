import { type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/errors";
import { generateApiKey, maskApiKey } from "@/lib/api-keys";
import { getOrCreateWorkspaceId } from "@/lib/session";

const createKeySchema = z.object({
  name: z.string().min(1).max(80),
});

export async function POST(request: NextRequest) {
  try {
    const workspaceId = await getOrCreateWorkspaceId();
    const body = await request.json();
    const parsed = createKeySchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message, 400);
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
    return errorResponse(message, 500);
  }
}

export async function GET() {
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
    return errorResponse(message, 500);
  }
}
