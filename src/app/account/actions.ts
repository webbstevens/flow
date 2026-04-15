"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { generateApiKey } from "@/lib/api-keys";
import { getOrCreateWorkspaceId, getWorkspaceId } from "@/lib/session";

export async function createKeyAction(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  if (!name) return { error: "Name is required" } as const;
  if (name.length > 80) return { error: "Name too long" } as const;

  const workspaceId = await getOrCreateWorkspaceId();
  const { fullKey, prefix, keyHash } = generateApiKey();

  const created = await prisma.apiKey.create({
    data: {
      workspaceId,
      prefix,
      keyHash,
      name,
    },
    select: { id: true, prefix: true, name: true },
  });

  revalidatePath("/account");
  return { success: true, fullKey, id: created.id, name: created.name } as const;
}

export async function revokeKeyAction(keyId: string) {
  const workspaceId = await getWorkspaceId();
  if (!workspaceId) return { error: "No workspace session" } as const;

  const existing = await prisma.apiKey.findUnique({ where: { id: keyId } });
  if (!existing || existing.workspaceId !== workspaceId) {
    return { error: "Key not found" } as const;
  }

  await prisma.apiKey.update({
    where: { id: keyId },
    data: { revokedAt: new Date() },
  });

  revalidatePath("/account");
  return { success: true } as const;
}
