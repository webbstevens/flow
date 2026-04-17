/**
 * Per-lane annotations on certificate_catalog rows.
 *
 * Option C compliance refactor (issue #15). Instead of asking the LLM
 * to enumerate documents freehand (the old `required_documents` JSON),
 * we show it every *triggered* catalog row for the product's HS chapter
 * and destination jurisdiction and ask, per row: does this apply?
 *
 * Output: one `ClassificationCatalogAnnotation` per catalog row. The
 * envelope exposed to API callers is derived by joining catalog rows
 * with these annotations (see src/lib/requirements-v2.ts — next PR).
 *
 * Gated behind process.env.REQUIREMENTS_V2 === "true" until the
 * unified UI ships in PR 3.
 */

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { prisma } from "@/lib/prisma";
import { isClaudeConfigured } from "@/lib/anthropic";
import { hs6 } from "@/lib/requirements";
import { jurisdictionForCountry } from "@/lib/certificate-catalog";

export type AnnotationStatus =
  | "flow_validating"
  | "verified"
  | "manual_override";

export type AnnotationSource =
  | "llm"
  | "manual"
  | "uk_trade_tariff"
  | "taric"
  | "ace";

export interface CatalogAnnotation {
  catalogCode: string;
  llmConfirmed: boolean;
  rationale: string;
  confidence: number | null;
  severityOverride: string | null;
  note: string | null;
  status: AnnotationStatus;
  source: AnnotationSource;
  updatedAt: string;
  verifiedAt: string | null;
}

export interface AnnotationInput {
  hsCode: string;
  originCountry: string | null;
  destinationCountry: string;
  productTitle?: string | null;
  productDescription?: string | null;
  materials?: string | null;
}

export function isRequirementsV2Enabled(): boolean {
  return process.env.REQUIREMENTS_V2 === "true";
}

function normalizeOrigin(origin: string | null | undefined): string {
  if (!origin) return "ANY";
  const trimmed = origin.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(trimmed) ? trimmed : "ANY";
}

/**
 * Catalog rows triggered for this product's HS chapter and destination
 * jurisdiction. A row is triggered if its `triggeringHsChapters` is
 * empty (= match any) OR contains the HS2 chapter derived from hsCode,
 * AND its jurisdiction matches destination jurisdiction or is INTL.
 */
async function triggeredCatalogRows(
  hsCode: string,
  destinationCountry: string,
) {
  const chapter = Number.parseInt(hs6(hsCode).slice(0, 2), 10);
  const jurisdiction = jurisdictionForCountry(destinationCountry);
  if (!jurisdiction) return [];

  const rows = await prisma.certificateCatalog.findMany({
    where: {
      jurisdiction: { in: [jurisdiction, "INTL"] },
    },
    include: { agency: true },
    orderBy: [{ agencyCode: "asc" }, { code: "asc" }],
  });

  return rows.filter((row) => {
    const triggers = Array.isArray(row.triggeringHsChapters)
      ? (row.triggeringHsChapters as number[])
      : [];
    return triggers.length === 0 || triggers.includes(chapter);
  });
}

async function findCachedAnnotations(
  hsCode: string,
  originCountry: string | null,
  destinationCountry: string,
): Promise<CatalogAnnotation[]> {
  const rows = await prisma.classificationCatalogAnnotation.findMany({
    where: {
      hsCodePrefix: hs6(hsCode),
      originCountry: normalizeOrigin(originCountry),
      destinationCountry,
    },
  });
  return rows.map(rowToAnnotation);
}

function rowToAnnotation(row: {
  catalogCode: string;
  llmConfirmed: boolean;
  rationale: string;
  confidence: number | null;
  severityOverride: string | null;
  note: string | null;
  status: string;
  source: string;
  updatedAt: Date;
  verifiedAt: Date | null;
}): CatalogAnnotation {
  return {
    catalogCode: row.catalogCode,
    llmConfirmed: row.llmConfirmed,
    rationale: row.rationale,
    confidence: row.confidence,
    severityOverride: row.severityOverride,
    note: row.note,
    status: row.status as AnnotationStatus,
    source: row.source as AnnotationSource,
    updatedAt: row.updatedAt.toISOString(),
    verifiedAt: row.verifiedAt ? row.verifiedAt.toISOString() : null,
  };
}

// ---------------------------------------------------------------------------
// LLM inference
// ---------------------------------------------------------------------------

const AnnotationSchema = z.object({
  annotations: z
    .array(
      z.object({
        catalog_code: z
          .string()
          .describe(
            "Exact code from the catalog shown to you. Must match one of the provided codes.",
          ),
        applies: z
          .boolean()
          .describe(
            "True if this document/declaration applies to the product on this lane; false otherwise.",
          ),
        rationale: z
          .string()
          .max(300)
          .describe(
            "One sentence on why it applies (or why it does not). Concrete — cite the HS chapter, material, or destination rule.",
          ),
        severity_override: z
          .enum(["required", "conditional", "alternative", "informational"])
          .nullable()
          .describe(
            "Override the catalog's default severity for this lane, or null to inherit. Use 'alternative' for EU Y-code / positive-cert pairs where the importer submits one or the other.",
          ),
      }),
    )
    .describe(
      "One entry per catalog row shown to you. You must annotate every row — do not omit any.",
    ),
  overall_confidence: z
    .number()
    .int()
    .min(0)
    .max(100)
    .describe(
      "0–100 confidence the annotations collectively cover the true requirement set for this lane.",
    ),
});

type InferredAnnotations = z.infer<typeof AnnotationSchema>;

async function inferWithClaude(
  input: AnnotationInput,
  catalog: Array<{
    code: string;
    title: string;
    description: string;
    type: string;
    jurisdiction: string;
    defaultSeverity: string;
    agencyCode: string;
    triggeringHsChapters: unknown;
    agency: { name: string };
  }>,
): Promise<InferredAnnotations> {
  const client = new Anthropic();

  const catalogText = catalog
    .map((c) => {
      const chapters = Array.isArray(c.triggeringHsChapters)
        ? (c.triggeringHsChapters as number[]).join(",")
        : "";
      const triggerNote = chapters ? `HS ch [${chapters}]` : "HS any";
      return `  ${c.code.padEnd(24)} [${c.type}] ${c.title} — ${c.agency.name} (${c.agencyCode}; ${triggerNote}; default=${c.defaultSeverity}). ${c.description}`;
    })
    .join("\n");

  const prompt = [
    "You are a cross-border customs compliance expert annotating the US/EU/UK certificate catalog for a specific product lane.",
    "",
    `HS code: ${input.hsCode}`,
    `HS subheading (6-digit): ${hs6(input.hsCode)}`,
    `HS chapter (2-digit): ${hs6(input.hsCode).slice(0, 2)}`,
    `Origin: ${input.originCountry ?? "unknown"}`,
    `Destination: ${input.destinationCountry}`,
    input.productTitle ? `Product title: ${input.productTitle}` : null,
    input.productDescription
      ? `Product description: ${input.productDescription}`
      : null,
    input.materials ? `Materials: ${input.materials}` : null,
    "",
    "Catalog rows triggered for this HS chapter and destination:",
    "",
    catalogText,
    "",
    "For EACH row above, decide whether the document applies on this lane:",
    "- applies=true if this specific product on this specific lane requires (or is exempt via) that code.",
    "- applies=false if the row is triggered by chapter but not by the actual product details (e.g. chapter 84 triggers EPA_HS7 for motor vehicles, but an unrelated chapter-84 item does not).",
    "- Always mark universal commercial docs (COMMERCIAL_INVOICE, PACKING_LIST, BILL_OF_LADING or AIRWAY_BILL, PROFORMA_INVOICE) applies=true. Pick exactly one of BILL_OF_LADING vs AIRWAY_BILL based on likely mode; mark the other false.",
    "- For EU Y-code / positive-permit pairs (C400/Y908, X002/Y901, C729/Y902, C644/Y903), mark both applies=true with severity_override='alternative'.",
    "- Blanket EU sanctions Y-codes (Y928, Y984, Y999) are always applies=true, severity inherits.",
    "- Rationale must be concrete (reference the chapter, material, or destination rule).",
    "- You MUST emit exactly one annotation per row shown — do not omit any.",
  ]
    .filter(Boolean)
    .join("\n");

  const response = await client.messages.parse({
    model: "claude-opus-4-6",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
    output_config: { format: zodOutputFormat(AnnotationSchema) },
  });

  if (!response.parsed_output) {
    throw new Error("Claude did not return parseable annotations");
  }
  return response.parsed_output;
}

// ---------------------------------------------------------------------------
// getOrInferAnnotations — cache-then-infer-then-persist
// ---------------------------------------------------------------------------

export async function getOrInferAnnotations(
  input: AnnotationInput,
): Promise<CatalogAnnotation[] | null> {
  const dest = input.destinationCountry.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(dest)) return null;
  if (!jurisdictionForCountry(dest)) return null;

  const triggered = await triggeredCatalogRows(input.hsCode, dest);
  if (triggered.length === 0) return [];

  const cached = await findCachedAnnotations(
    input.hsCode,
    input.originCountry,
    dest,
  );
  const cachedCodes = new Set(cached.map((a) => a.catalogCode));
  const missing = triggered.filter((r) => !cachedCodes.has(r.code));
  if (missing.length === 0) return cached;

  if (!isClaudeConfigured()) {
    // Without a key, persist mock annotations for missing rows so the
    // UI still has something to render.
    return await persistAndReturn(
      input,
      dest,
      cached,
      missing.map((r) => ({
        catalog_code: r.code,
        applies: r.triggeringHsChapters
          ? !Array.isArray(r.triggeringHsChapters) ||
            (r.triggeringHsChapters as number[]).length === 0
          : true,
        rationale: "Mock annotation — set ANTHROPIC_API_KEY for real inference.",
        severity_override: null,
      })),
      null,
    );
  }

  let inferred: InferredAnnotations;
  try {
    inferred = await inferWithClaude({ ...input, destinationCountry: dest }, missing);
  } catch (err) {
    console.error("[catalog-annotations] inference failed", err);
    return cached.length > 0 ? cached : null;
  }

  const triggeredCodes = new Set(missing.map((r) => r.code));
  const clean = inferred.annotations.filter((a) =>
    triggeredCodes.has(a.catalog_code),
  );

  return await persistAndReturn(
    input,
    dest,
    cached,
    clean,
    inferred.overall_confidence,
  );
}

async function persistAndReturn(
  input: AnnotationInput,
  dest: string,
  cached: CatalogAnnotation[],
  fresh: Array<{
    catalog_code: string;
    applies: boolean;
    rationale: string;
    severity_override: string | null;
  }>,
  confidence: number | null,
): Promise<CatalogAnnotation[]> {
  const written: CatalogAnnotation[] = [];
  for (const a of fresh) {
    const row = await prisma.classificationCatalogAnnotation.upsert({
      where: {
        hsCodePrefix_originCountry_destinationCountry_catalogCode: {
          hsCodePrefix: hs6(input.hsCode),
          originCountry: normalizeOrigin(input.originCountry),
          destinationCountry: dest,
          catalogCode: a.catalog_code,
        },
      },
      create: {
        hsCodePrefix: hs6(input.hsCode),
        originCountry: normalizeOrigin(input.originCountry),
        destinationCountry: dest,
        catalogCode: a.catalog_code,
        llmConfirmed: a.applies,
        rationale: a.rationale,
        confidence,
        severityOverride: a.severity_override,
        note: null,
        status: "flow_validating",
        source: "llm",
      },
      update: {}, // no-op on race
    });
    written.push(rowToAnnotation(row));
  }
  return [...cached, ...written];
}
