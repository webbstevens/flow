/**
 * Requirements inference + cache.
 *
 * Given an (HS6, origin, destination) triple, return the set of customs
 * documents / Y-codes / PGA flags that apply. Uses a `classification_requirements`
 * table as a shared cache across classifications.
 *
 * Lifecycle:
 *   1. Cache miss → Claude infers a requirement constrained to the
 *      certificate catalog. Row persisted with status='flow_validating',
 *      source='llm'.
 *   2. (Later) reconcile job hits an authoritative source (UK Trade Tariff
 *      API, TARIC, ACE) and flips status='verified', source=<authoritative>.
 *   3. (Later) operator edit flips status='manual_override', source='manual'.
 */

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { prisma } from "@/lib/prisma";
import {
  CERTIFICATE_CATALOG,
  catalogForJurisdiction,
  getCertificate,
  isCertificateCode,
  jurisdictionForCountry,
  AGENCY_NAMES,
  type CertificateEntry,
  type CertificateJurisdiction,
  type CertificateTypeCode,
} from "@/lib/certificate-catalog";
import { isClaudeConfigured } from "@/lib/anthropic";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type RequirementStatus =
  | "flow_validating"
  | "verified"
  | "manual_override";

export type RequirementSource =
  | "llm"
  | "uk_trade_tariff"
  | "taric"
  | "ace"
  | "manual";

export type DocumentSeverity =
  | "required"
  | "alternative" // One of a set, operator picks
  | "informational";

export interface RequiredDocument {
  certificate_code: string;
  name: string;
  agency: string;
  agency_name: string;
  jurisdiction: CertificateJurisdiction;
  type: CertificateTypeCode;
  severity: DocumentSeverity;
  note?: string;
}

export interface RequirementWarning {
  code: string;
  message: string;
}

export interface RequirementEnvelope {
  status: RequirementStatus;
  source: RequirementSource;
  confidence: number | null;
  destination_country: string;
  origin_country: string;
  required_documents: RequiredDocument[];
  warnings: RequirementWarning[];
  updated_at: string;
  verified_at: string | null;
}

export interface RequirementInput {
  hsCode: string; // full HS/HTS — we derive the 6-digit key internally
  originCountry: string | null; // ISO2 or null → "ANY"
  destinationCountry: string; // ISO2
  productTitle?: string | null;
  productDescription?: string | null;
  materials?: string | null;
}

// ---------------------------------------------------------------------------
// Cache read / lookup
// ---------------------------------------------------------------------------

/**
 * 6-digit WCO HS subheading from a possibly-dotted HTS code.
 * "6109.10.0012" → "610910", "6109" → "610900" (padded).
 */
export function hs6(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length >= 6) return digits.slice(0, 6);
  return digits.padEnd(6, "0");
}

function normalizeOrigin(origin: string | null | undefined): string {
  if (!origin) return "ANY";
  const trimmed = origin.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(trimmed) ? trimmed : "ANY";
}

export async function findCachedRequirement(
  hsCode: string,
  originCountry: string | null,
  destinationCountry: string,
): Promise<RequirementEnvelope | null> {
  const row = await prisma.classificationRequirement.findUnique({
    where: {
      hsCodePrefix_originCountry_destinationCountry: {
        hsCodePrefix: hs6(hsCode),
        originCountry: normalizeOrigin(originCountry),
        destinationCountry,
      },
    },
  });
  if (!row) return null;
  return rowToEnvelope(row);
}

// ---------------------------------------------------------------------------
// Inference (Claude)
// ---------------------------------------------------------------------------

const InferredDocSchema = z.object({
  certificate_code: z
    .string()
    .describe(
      "Exact code from the provided catalog (e.g. 'Y901', 'C400', 'FDA_PN'). Do not invent codes.",
    ),
  severity: z
    .enum(["required", "alternative", "informational"])
    .describe(
      "'required' if the doc/declaration must be submitted; 'alternative' if it is one of a set (typically a positive permit OR a Y-declaration saying the good is exempt); 'informational' for advisory items.",
    ),
  note: z
    .string()
    .describe(
      "Short 1-sentence explanation of why this code applies to this product. Empty string if nothing useful to add.",
    ),
});

const InferenceSchema = z.object({
  confidence: z
    .number()
    .int()
    .min(0)
    .max(100)
    .describe("0-100 confidence the selected codes are complete and correct."),
  required_documents: z
    .array(InferredDocSchema)
    .describe(
      "Documents/declarations applicable for this HS subheading + destination. Always include universal commercial docs (COMMERCIAL_INVOICE, PACKING_LIST, BILL_OF_LADING) as 'required'.",
    ),
  warnings: z
    .array(
      z.object({
        code: z
          .string()
          .describe("Short kebab-case warning code, e.g. 'cites-ambiguous'."),
        message: z.string(),
      }),
    )
    .describe(
      "Edge cases worth surfacing to a human reviewer. Empty array if none.",
    ),
});

type InferredRequirement = z.infer<typeof InferenceSchema>;

async function inferWithClaude(
  input: RequirementInput,
  catalog: CertificateEntry[],
): Promise<InferredRequirement> {
  const client = new Anthropic();

  const catalogText = catalog
    .map(
      (c) =>
        `  ${c.code.padEnd(20)} [${c.type}] ${c.name} (${c.jurisdiction}${
          c.agency !== "NONE" ? `, ${c.agency}` : ""
        }) — ${c.description}`,
    )
    .join("\n");

  const prompt = [
    "You are a cross-border customs compliance expert.",
    "Given a product's HS code, origin, and destination country, determine which customs documents, declarations, permits, or Y-codes (EU negative declarations) apply.",
    "",
    `HS code (full): ${input.hsCode}`,
    `HS subheading (6-digit): ${hs6(input.hsCode)}`,
    `Origin country: ${input.originCountry ?? "unknown"}`,
    `Destination country: ${input.destinationCountry}`,
    input.productTitle ? `Product title: ${input.productTitle}` : null,
    input.productDescription
      ? `Product description: ${input.productDescription}`
      : null,
    input.materials ? `Materials: ${input.materials}` : null,
    "",
    "Pick codes ONLY from the following catalog. If a relevant item is not in the catalog, describe it in `warnings` instead of inventing a code:",
    "",
    catalogText,
    "",
    "Rules:",
    "- Always include COMMERCIAL_INVOICE, PACKING_LIST, BILL_OF_LADING as 'required'.",
    "- For EU destinations: if the good could plausibly be CITES-listed, include C400 and Y908 as 'alternative' (importer submits one or the other). Same pattern for dual-use (X002 / Y901), ozone (C729 / Y902), cultural goods (C644 / Y903).",
    "- For US destinations: include relevant PGA flags only if the product plausibly falls under that agency's jurisdiction. Do not shotgun every PGA flag.",
    "- For preferential origin between jurisdictions with an FTA (e.g. US→UK via the TCA, USMCA for US↔MX/CA), include the appropriate origin document as 'informational' with a note that eligibility depends on origin content calc.",
    "- Sanctions Y-codes (Y928, Y984, Y999) for EU destinations are typically 'required' as blanket declarations on all shipments.",
    "- Confidence should reflect how confident you are this covers the full requirement set, not just how confident you are in the HS code.",
  ]
    .filter(Boolean)
    .join("\n");

  const response = await client.messages.parse({
    model: "claude-opus-4-6",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
    output_config: { format: zodOutputFormat(InferenceSchema) },
  });

  if (!response.parsed_output) {
    throw new Error("Claude did not return a parseable requirement");
  }

  return response.parsed_output;
}

// ---------------------------------------------------------------------------
// getOrInfer — cache-then-infer-then-persist
// ---------------------------------------------------------------------------

export async function getOrInferRequirement(
  input: RequirementInput,
): Promise<RequirementEnvelope | null> {
  const dest = input.destinationCountry.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(dest)) return null;

  const jurisdiction = jurisdictionForCountry(dest);
  if (!jurisdiction) {
    // Out of scope for v1 (US/UK/EU only).
    return null;
  }

  const cached = await findCachedRequirement(
    input.hsCode,
    input.originCountry,
    dest,
  );
  if (cached) return cached;

  let inferred: InferredRequirement;
  try {
    inferred = isClaudeConfigured()
      ? await inferWithClaude(
          { ...input, destinationCountry: dest },
          catalogForJurisdiction(jurisdiction),
        )
      : mockInference(jurisdiction);
  } catch (err) {
    console.error("[requirements] inference failed", err);
    return null;
  }

  // Drop codes Claude hallucinated that aren't in the catalog.
  const cleanDocs = inferred.required_documents.filter((d) =>
    isCertificateCode(d.certificate_code),
  );

  const row = await prisma.classificationRequirement.upsert({
    where: {
      hsCodePrefix_originCountry_destinationCountry: {
        hsCodePrefix: hs6(input.hsCode),
        originCountry: normalizeOrigin(input.originCountry),
        destinationCountry: dest,
      },
    },
    create: {
      hsCodePrefix: hs6(input.hsCode),
      originCountry: normalizeOrigin(input.originCountry),
      destinationCountry: dest,
      requiredDocuments: cleanDocs,
      warnings: inferred.warnings,
      status: "flow_validating",
      source: "llm",
      confidence: inferred.confidence,
    },
    update: {}, // no-op on race
  });

  return rowToEnvelope(row);
}

// ---------------------------------------------------------------------------
// Row → Envelope (enriches with catalog display names)
// ---------------------------------------------------------------------------

interface RequirementRow {
  hsCodePrefix: string;
  originCountry: string;
  destinationCountry: string;
  requiredDocuments: unknown;
  warnings: unknown;
  status: string;
  source: string;
  confidence: number | null;
  updatedAt: Date;
  verifiedAt: Date | null;
}

function rowToEnvelope(row: RequirementRow): RequirementEnvelope {
  const rawDocs = Array.isArray(row.requiredDocuments)
    ? (row.requiredDocuments as Array<{
        certificate_code: string;
        severity?: string;
        note?: string;
      }>)
    : [];

  const docs: RequiredDocument[] = [];
  for (const d of rawDocs) {
    const cat = getCertificate(d.certificate_code);
    if (!cat) continue;
    const doc: RequiredDocument = {
      certificate_code: cat.code,
      name: cat.name,
      agency: cat.agency,
      agency_name: AGENCY_NAMES[cat.agency] ?? cat.agency,
      jurisdiction: cat.jurisdiction,
      type: cat.type,
      severity: (d.severity as DocumentSeverity) ?? "required",
    };
    if (d.note) doc.note = d.note;
    docs.push(doc);
  }

  const warnings: RequirementWarning[] = Array.isArray(row.warnings)
    ? (row.warnings as RequirementWarning[])
    : [];

  return {
    status: row.status as RequirementStatus,
    source: row.source as RequirementSource,
    confidence: row.confidence,
    destination_country: row.destinationCountry,
    origin_country: row.originCountry,
    required_documents: docs,
    warnings,
    updated_at: row.updatedAt.toISOString(),
    verified_at: row.verifiedAt ? row.verifiedAt.toISOString() : null,
  };
}

// ---------------------------------------------------------------------------
// Mock (when ANTHROPIC_API_KEY isn't set)
// ---------------------------------------------------------------------------

function mockInference(
  jurisdiction: "US" | "EU" | "UK",
): InferredRequirement {
  const base: InferredRequirement["required_documents"] = [
    {
      certificate_code: "COMMERCIAL_INVOICE",
      severity: "required",
      note: "Standard commercial invoice.",
    },
    {
      certificate_code: "PACKING_LIST",
      severity: "required",
      note: "",
    },
    {
      certificate_code: "BILL_OF_LADING",
      severity: "required",
      note: "",
    },
  ];

  if (jurisdiction === "EU") {
    base.push(
      {
        certificate_code: "Y901",
        severity: "required",
        note: "Blanket dual-use declaration.",
      },
      {
        certificate_code: "Y999",
        severity: "required",
        note: "Russia sanctions declaration (mock).",
      },
    );
  } else if (jurisdiction === "US") {
    base.push({
      certificate_code: "CPSC_GCC",
      severity: "informational",
      note: "Mock — only required if product falls under a CPSC rule.",
    });
  }

  return {
    confidence: 55,
    required_documents: base,
    warnings: [
      {
        code: "mock-inference",
        message:
          "Mock requirement response — set ANTHROPIC_API_KEY for real inference.",
      },
    ],
  };
}

// Fallback envelope used when a classification has a destination but we chose
// not to (or couldn't) infer a requirement. Lets the UI still render the card
// with an explanatory state instead of hiding it.
export function emptyEnvelope(
  destinationCountry: string,
  originCountry: string | null,
): RequirementEnvelope {
  return {
    status: "flow_validating",
    source: "llm",
    confidence: null,
    destination_country: destinationCountry,
    origin_country: normalizeOrigin(originCountry),
    required_documents: [],
    warnings: [],
    updated_at: new Date().toISOString(),
    verified_at: null,
  };
}

// Re-export catalog type for callers
export { CERTIFICATE_CATALOG };
