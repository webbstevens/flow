/**
 * Compliance state derivation.
 *
 * A classification record is either `compliant` or `partially_compliant`.
 * The rules live in one place so API responses and UI banners stay in sync.
 *
 * Business rules (see compliance PRD):
 *   - A record is `compliant` only when:
 *       1. `hs_code` is present and has 6-10 digits (dots stripped)
 *       2. `country_of_origin` is a 2-letter ISO code
 *       3. `requires_review` is false (which, per `anthropic.ts`, implies
 *          `confidence_score >= 80`)
 *   - Otherwise it is `partially_compliant` and we surface which fields
 *     are missing plus any warnings the UI should display.
 */

export type ComplianceStatus = "compliant" | "partially_compliant";

export type WarningCode = "LOW_CONFIDENCE" | "RESTRICTED_GOODS";

export interface ComplianceWarning {
  code: WarningCode;
  message: string;
}

export interface ComplianceEvaluation {
  status: ComplianceStatus;
  missing_required_fields: string[];
  warnings: ComplianceWarning[];
}

export interface ComplianceInput {
  hsCode: string | null | undefined;
  countryOfOrigin: string | null | undefined;
  confidenceScore: number;
  requiresReview: boolean;
  restrictedGoodsFlag: boolean;
}

const MIN_HS_DIGITS = 6;
const MAX_HS_DIGITS = 10;
const CONFIDENCE_THRESHOLD = 80;

export function deriveCompliance(input: ComplianceInput): ComplianceEvaluation {
  const missing: string[] = [];

  if (!isValidHsCode(input.hsCode)) {
    missing.push("hs_code");
  }
  if (!isValidIsoCountry(input.countryOfOrigin)) {
    missing.push("country_of_origin");
  }

  const warnings: ComplianceWarning[] = [];
  if (input.confidenceScore < CONFIDENCE_THRESHOLD) {
    warnings.push({
      code: "LOW_CONFIDENCE",
      message: `HS Code prediction confidence is ${input.confidenceScore}%. Manual review required before publishing.`,
    });
  }
  if (input.restrictedGoodsFlag) {
    warnings.push({
      code: "RESTRICTED_GOODS",
      message:
        "Product may be subject to CITES, dual-use, sanctions, or other cross-border restrictions. Extra documentation may be required.",
    });
  }

  const status: ComplianceStatus =
    missing.length > 0 || input.requiresReview
      ? "partially_compliant"
      : "compliant";

  return { status, missing_required_fields: missing, warnings };
}

/**
 * Shape of the `data` payload returned by the compliance API for a single
 * classification record. Shared between `POST /classify` and
 * `GET /history` so UI consumers can use one type.
 */
export interface ClassificationEnvelope {
  classification_id: string;
  compliance_status: ComplianceStatus;
  classification: {
    hs_code: string;
    coo: string | null;
    mid_code: string | null;
    customs_description: string | null;
    materials: string | null;
  };
  ai_metadata: {
    confidence_score: number;
    requires_review: boolean;
    attributes: Record<string, unknown>;
  };
  actionable_flags: {
    missing_required_fields: string[];
    warnings: ComplianceWarning[];
    restricted_goods_flag: boolean;
  };
  source: {
    product_url: string | null;
    title: string | null;
  };
  image_url: string | null;
  created_at: string;
}

export interface RawClassificationRecord {
  id: string;
  hsCode: string;
  midCode: string | null;
  countryOfOrigin: string | null;
  materials: string | null;
  customsDescription: string | null;
  confidenceScore: number;
  requiresReview: boolean;
  restrictedGoodsFlag: boolean;
  aiAttributes: Record<string, unknown> | null;
  productUrl: string | null;
  sourceTitle: string | null;
  createdAt: Date;
  imageUrl: string | null;
}

export function buildClassificationEnvelope(
  record: RawClassificationRecord,
): ClassificationEnvelope {
  const evaluation = deriveCompliance({
    hsCode: record.hsCode,
    countryOfOrigin: record.countryOfOrigin,
    confidenceScore: record.confidenceScore,
    requiresReview: record.requiresReview,
    restrictedGoodsFlag: record.restrictedGoodsFlag,
  });

  return {
    classification_id: record.id,
    compliance_status: evaluation.status,
    classification: {
      hs_code: record.hsCode,
      coo: record.countryOfOrigin,
      mid_code: record.midCode,
      customs_description: record.customsDescription,
      materials: record.materials,
    },
    ai_metadata: {
      confidence_score: record.confidenceScore,
      requires_review: record.requiresReview,
      attributes: record.aiAttributes ?? {},
    },
    actionable_flags: {
      missing_required_fields: evaluation.missing_required_fields,
      warnings: evaluation.warnings,
      restricted_goods_flag: record.restrictedGoodsFlag,
    },
    source: {
      product_url: record.productUrl,
      title: record.sourceTitle,
    },
    image_url: record.imageUrl,
    created_at: record.createdAt.toISOString(),
  };
}

function isValidHsCode(code: string | null | undefined): boolean {
  if (!code) return false;
  const digits = code.replace(/\./g, "");
  if (!/^\d+$/.test(digits)) return false;
  return digits.length >= MIN_HS_DIGITS && digits.length <= MAX_HS_DIGITS;
}

function isValidIsoCountry(cc: string | null | undefined): boolean {
  if (!cc) return false;
  return /^[A-Z]{2}$/.test(cc);
}
