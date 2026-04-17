/**
 * Classification rationale — GRI-step analysis + section/chapter note review.
 *
 * Given a ClassificationRecord, return the legal reasoning that supports its
 * HS code: which General Rules of Interpretation were applied and which
 * section/chapter notes were reviewed. Used as an audit trail by broker
 * customers via `GET /api/v1/compliance/classify/{id}/rationale`.
 *
 * Lifecycle mirrors the requirements module:
 *   1. Cache miss → Claude generates a structured rationale. Row persisted
 *      with status='flow_validating', source='llm'.
 *   2. (Later) reconcile against WCO explanatory notes → status='verified'.
 *   3. (Later) operator edit → status='manual_override', source='manual'.
 *
 * Cache key is (hs_code, attributes_hash) so two records classifying the same
 * product share a row while different products under the same HS10 don't.
 */

import { createHash } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { prisma } from "@/lib/prisma";
import { isClaudeConfigured } from "@/lib/anthropic";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type RationaleStatus =
  | "flow_validating"
  | "verified"
  | "manual_override";

export type RationaleSource = "llm" | "wco_explanatory_notes" | "manual";

export const GRI_RULES = [
  "GRI 1",
  "GRI 2(a)",
  "GRI 2(b)",
  "GRI 3(a)",
  "GRI 3(b)",
  "GRI 3(c)",
  "GRI 4",
  "GRI 5(a)",
  "GRI 5(b)",
  "GRI 6",
] as const;
export type GriRule = (typeof GRI_RULES)[number];

export type GriOutcome =
  | "provisional_classification"
  | "subheading_selected"
  | "heading_eliminated"
  | "disambiguated";

export type NoteRelevance =
  | "confirms_inclusion"
  | "confirms_exclusion"
  | "clarifies_definition";

export interface GriStep {
  rule: GriRule;
  reasoning: string;
  outcome: GriOutcome;
}

export interface NoteReview {
  scope: string; // e.g. "section_xi_note_1", "chapter_61_note_9"
  text_excerpt: string;
  relevance: NoteRelevance;
}

export interface RationaleEnvelope {
  classification_id: string;
  hs_code: string;
  status: RationaleStatus;
  source: RationaleSource;
  confidence: number | null;
  gri_steps: GriStep[];
  notes_reviewed: NoteReview[];
  generated_at: string;
  verified_at: string | null;
}

export interface RationaleInput {
  recordId: string;
  hsCode: string;
  title: string | null;
  materials: string | null;
  customsDescription: string | null;
  category: string | null;
}

// ---------------------------------------------------------------------------
// Hashing
// ---------------------------------------------------------------------------

/**
 * Normalize + hash the product attributes that affect classification reasoning.
 * Two records with the same (title|materials|category) — case/whitespace
 * insensitive — produce the same hash and share a cached rationale row.
 */
export function hashAttributes(
  title: string | null,
  materials: string | null,
  category: string | null,
): string {
  const norm = (s: string | null) =>
    (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  const input = [norm(title), norm(materials), norm(category)].join("|");
  return createHash("sha256").update(input).digest("hex");
}

// ---------------------------------------------------------------------------
// Cache read
// ---------------------------------------------------------------------------

export async function findCachedRationale(
  hsCode: string,
  attributesHash: string,
  classificationId: string,
): Promise<RationaleEnvelope | null> {
  const row = await prisma.classificationRationale.findUnique({
    where: { hsCode_attributesHash: { hsCode, attributesHash } },
  });
  if (!row) return null;
  return rowToEnvelope(row, classificationId);
}

// ---------------------------------------------------------------------------
// Inference (Claude)
// ---------------------------------------------------------------------------

const RationaleSchema = z.object({
  confidence: z
    .number()
    .int()
    .min(0)
    .max(100)
    .describe(
      "0-100 confidence that the GRI reasoning below correctly supports the assigned HS code.",
    ),
  gri_steps: z
    .array(
      z.object({
        rule: z
          .enum(GRI_RULES)
          .describe("Which General Rule of Interpretation was applied."),
        reasoning: z
          .string()
          .max(800)
          .describe(
            "Concise explanation of how this rule applies to this product. Cite the specific heading/subheading text when possible.",
          ),
        outcome: z.enum([
          "provisional_classification",
          "subheading_selected",
          "heading_eliminated",
          "disambiguated",
        ]),
      }),
    )
    .min(1)
    .max(6)
    .describe(
      "Ordered steps from broadest rule applied to the final classification. Most products only need GRI 1 and GRI 6.",
    ),
  notes_reviewed: z
    .array(
      z.object({
        scope: z
          .string()
          .describe(
            "Snake-case identifier of the note, e.g. 'section_xi_note_1' or 'chapter_61_note_9'.",
          ),
        text_excerpt: z
          .string()
          .max(400)
          .describe(
            "Short quotation of the note text that applies. Do not paraphrase — quote.",
          ),
        relevance: z.enum([
          "confirms_inclusion",
          "confirms_exclusion",
          "clarifies_definition",
        ]),
      }),
    )
    .max(4)
    .describe(
      "Section or chapter notes that were reviewed while classifying. Empty array if none applied.",
    ),
});

type InferredRationale = z.infer<typeof RationaleSchema>;

async function inferWithClaude(
  input: RationaleInput,
): Promise<InferredRationale> {
  const client = new Anthropic();

  const prompt = [
    "You are a licensed customs broker explaining, for an audit file, why a product was classified under a specific HS code.",
    "Apply the General Rules of Interpretation (GRIs 1–6) in order. For most products, only GRI 1 and GRI 6 are needed. Use GRI 2/3/4/5 only when they actually arise.",
    "",
    `HS code assigned: ${input.hsCode}`,
    input.title ? `Product title: ${input.title}` : null,
    input.materials ? `Materials: ${input.materials}` : null,
    input.customsDescription
      ? `Customs description: ${input.customsDescription}`
      : null,
    input.category ? `Category: ${input.category}` : null,
    "",
    "Rules:",
    "- Cite real WCO heading text, not invented text. If you are not sure of exact heading language, paraphrase conservatively rather than fabricating a quotation.",
    "- Section and chapter note scopes must use real section/chapter numbers — e.g. Section XI covers textiles, Chapter 61 covers knitted apparel. Do NOT invent note numbers.",
    "- `text_excerpt` for notes_reviewed must be a conservative paraphrase or a genuinely remembered quotation; never hallucinate specific wording.",
    "- `outcome` values:",
    "    provisional_classification — initial candidate heading/subheading",
    "    subheading_selected — final 6-digit (or deeper) determination",
    "    heading_eliminated — ruling out a plausible competing heading",
    "    disambiguated — GRI 3 tie-breaker applied",
    "- Confidence reflects how well the reasoning itself holds up, not how confident you are in the input HS code.",
  ]
    .filter(Boolean)
    .join("\n");

  const response = await client.messages.parse({
    model: "claude-opus-4-6",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
    output_config: { format: zodOutputFormat(RationaleSchema) },
  });

  if (!response.parsed_output) {
    throw new Error("Claude did not return a parseable rationale");
  }
  return response.parsed_output;
}

// ---------------------------------------------------------------------------
// getOrInfer — cache-then-infer-then-persist
// ---------------------------------------------------------------------------

export async function getOrInferRationale(
  input: RationaleInput,
): Promise<RationaleEnvelope | null> {
  const attributesHash = hashAttributes(
    input.title,
    input.materials,
    input.category,
  );

  const cached = await findCachedRationale(
    input.hsCode,
    attributesHash,
    input.recordId,
  );
  if (cached) return cached;

  let inferred: InferredRationale;
  try {
    inferred = isClaudeConfigured()
      ? await inferWithClaude(input)
      : mockRationale();
  } catch (err) {
    console.error("[rationale] inference failed", err);
    return null;
  }

  const row = await prisma.classificationRationale.upsert({
    where: { hsCode_attributesHash: { hsCode: input.hsCode, attributesHash } },
    create: {
      hsCode: input.hsCode,
      attributesHash,
      griSteps: inferred.gri_steps,
      notesReviewed: inferred.notes_reviewed,
      status: "flow_validating",
      source: "llm",
      confidence: inferred.confidence,
    },
    update: {}, // no-op on race
  });

  return rowToEnvelope(row, input.recordId);
}

// ---------------------------------------------------------------------------
// Row → Envelope
// ---------------------------------------------------------------------------

interface RationaleRow {
  hsCode: string;
  griSteps: unknown;
  notesReviewed: unknown;
  status: string;
  source: string;
  confidence: number | null;
  updatedAt: Date;
  verifiedAt: Date | null;
}

function rowToEnvelope(
  row: RationaleRow,
  classificationId: string,
): RationaleEnvelope {
  const steps: GriStep[] = Array.isArray(row.griSteps)
    ? (row.griSteps as GriStep[])
    : [];
  const notes: NoteReview[] = Array.isArray(row.notesReviewed)
    ? (row.notesReviewed as NoteReview[])
    : [];
  return {
    classification_id: classificationId,
    hs_code: row.hsCode,
    status: row.status as RationaleStatus,
    source: row.source as RationaleSource,
    confidence: row.confidence,
    gri_steps: steps,
    notes_reviewed: notes,
    generated_at: row.updatedAt.toISOString(),
    verified_at: row.verifiedAt ? row.verifiedAt.toISOString() : null,
  };
}

// ---------------------------------------------------------------------------
// Mock (when ANTHROPIC_API_KEY isn't set)
// ---------------------------------------------------------------------------

function mockRationale(): InferredRationale {
  return {
    confidence: 50,
    gri_steps: [
      {
        rule: "GRI 1",
        reasoning:
          "Mock — real reasoning is generated when ANTHROPIC_API_KEY is configured. The product is provisionally classified based on the terms of the heading.",
        outcome: "provisional_classification",
      },
      {
        rule: "GRI 6",
        reasoning:
          "Mock — the subheading at the 6-digit level is determined by the same rules applied at the heading level.",
        outcome: "subheading_selected",
      },
    ],
    notes_reviewed: [],
  };
}
