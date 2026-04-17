/**
 * Shared types + helpers for the Compliance envelope.
 *
 * As of Option C / #15 (PR 5), the v2 path in `requirements-v2.ts` is the
 * only producer. The legacy inference + `classification_requirements`
 * cache have been removed; this file now just exports the type surface
 * and the `hs6()` helper that callers still depend on.
 */

import type {
  CertificateJurisdiction,
  CertificateTypeCode,
} from "@/lib/certificate-catalog";

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
  | "alternative" // one of a set — operator picks
  | "informational";

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
  warnings: RequirementWarning[];
  updated_at: string;
  verified_at: string | null;
}

// Kept for downstream callers that still reference these types even though
// the freehand document list is gone from the envelope.
export type { CertificateJurisdiction, CertificateTypeCode };

/**
 * 6-digit WCO HS subheading from a possibly-dotted HTS code.
 * "6109.10.0012" → "610910", "6109" → "610900" (padded).
 */
export function hs6(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length >= 6) return digits.slice(0, 6);
  return digits.padEnd(6, "0");
}
