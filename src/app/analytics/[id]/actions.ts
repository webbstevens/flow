"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, getWorkspaceId } from "@/lib/session";

/**
 * Server actions for the analytics detail page.
 *
 * Scoped to "soft" (Tier 1) fields only — text and booleans that don't
 * invalidate the requirement cache or flip compliance derivation.
 * Hard fields (hs_code, country_of_origin, destination_country,
 * requires_review) need an explicit override dialog that re-runs inference
 * — see the "Tier 2" follow-up.
 */

const softPatchSchema = z
  .object({
    sourceTitle: z.string().max(500).optional(),
    materials: z.string().max(500).optional(),
    customsDescription: z.string().max(1000).optional(),
    midCode: z.string().max(50).optional(),
    restrictedGoodsFlag: z.boolean().optional(),
  })
  .strict();

type SoftPatch = z.infer<typeof softPatchSchema>;

export type SoftTextField =
  | "sourceTitle"
  | "materials"
  | "customsDescription"
  | "midCode";
export type SoftBoolField = "restrictedGoodsFlag";
export type SoftField = keyof SoftPatch;

/**
 * Core updater — verifies ownership, validates the patch, normalizes empty
 * strings to null for nullable text columns, writes, revalidates.
 *
 * Server actions are reachable via direct POST, so auth MUST be checked
 * inline (per Next 16 docs).
 */
async function applyPatch(id: string, patch: SoftPatch): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  const workspaceId = await getWorkspaceId();
  if (!workspaceId) throw new Error("Workspace required");

  const existing = await prisma.classificationRecord.findUnique({
    where: { id },
    select: { workspaceId: true },
  });
  if (!existing || existing.workspaceId !== workspaceId) {
    throw new Error("Not found");
  }

  const data: Record<string, unknown> = { ...patch };
  for (const key of [
    "sourceTitle",
    "materials",
    "customsDescription",
    "midCode",
  ] as const) {
    if (key in data && data[key] === "") {
      data[key] = null;
    }
  }

  await prisma.classificationRecord.update({
    where: { id },
    data,
  });

  revalidatePath(`/analytics/${id}`);
  revalidatePath("/analytics");
}

/**
 * Save a text-valued soft field. Bound per (id, field) in the page
 * component so client callers pass only the new value.
 */
export async function saveRecordText(
  id: string,
  field: SoftTextField,
  value: string,
): Promise<void> {
  const raw = { [field]: value };
  const parsed = softPatchSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  await applyPatch(id, parsed.data);
}

/**
 * Save a boolean-valued soft field.
 */
export async function saveRecordBool(
  id: string,
  field: SoftBoolField,
  value: boolean,
): Promise<void> {
  const raw = { [field]: value };
  const parsed = softPatchSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  await applyPatch(id, parsed.data);
}
