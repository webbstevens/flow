/**
 * Unified envelope builder for the Option C refactor (#15).
 *
 * Merges certificate_catalog rows with their per-lane
 * ClassificationCatalogAnnotation rows into a single view that
 *
 *   (a) stays byte-compatible with the existing RequirementEnvelope
 *       so API consumers of POST /v1/compliance/classify see no
 *       breaking change, and
 *
 *   (b) adds a richer `catalog_entries` list the UI uses to render
 *       the agency-grouped single list (see
 *       src/app/analytics/_components/RequirementsCard.tsx).
 *
 * Called only when process.env.REQUIREMENTS_V2 === "true".
 */

import { prisma } from "@/lib/prisma";
import {
  jurisdictionForCountry,
  AGENCY_NAMES,
} from "@/lib/certificate-catalog";
import {
  hs6,
  type RequirementEnvelope,
  type RequirementStatus,
  type RequirementSource,
  type RequirementWarning,
} from "@/lib/requirements";
import {
  getOrInferAnnotations,
  type CatalogAnnotation,
  type AnnotationInput,
} from "@/lib/catalog-annotations";
import {
  groupEntriesByStatus,
  normalizeSeverity,
  deriveEntryStatus,
  type CatalogEntry,
  type EntryStatus,
  type StatusBucket,
} from "@/lib/requirement-groups";

export {
  groupEntriesByStatus,
  normalizeSeverity,
  deriveEntryStatus,
};
export type { CatalogEntry, EntryStatus, StatusBucket };

/** Extended envelope — adds `catalog_entries` on top of the legacy shape. */
export interface UnifiedEnvelope extends RequirementEnvelope {
  catalog_entries: CatalogEntry[];
  counts: {
    tbd: number;
    required: number;
    manual_review: number;
    ready: number;
  };
  agencies_reviewed: number;
  total_regulations: number;
}

export async function buildUnifiedEnvelope(
  input: AnnotationInput,
): Promise<UnifiedEnvelope | null> {
  const dest = input.destinationCountry.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(dest)) return null;
  const jurisdiction = jurisdictionForCountry(dest);
  if (!jurisdiction) return null;

  // Load ALL catalog rows for this jurisdiction (not just triggered) so the
  // agency-grouped drawer still shows "ready" rows for context.
  const allCatalog = await prisma.certificateCatalog.findMany({
    where: { jurisdiction: { in: [jurisdiction, "INTL"] } },
    include: { agency: true },
    orderBy: [{ agencyCode: "asc" }, { code: "asc" }],
  });

  // Infer-or-cache annotations for triggered rows (this is the LLM call path).
  const annotations =
    (await getOrInferAnnotations({ ...input, destinationCountry: dest })) ?? [];
  const annotationByCode = new Map<string, CatalogAnnotation>();
  for (const a of annotations) annotationByCode.set(a.catalogCode, a);

  const chapter = Number.parseInt(hs6(input.hsCode).slice(0, 2), 10);
  const entries: CatalogEntry[] = [];
  const agencies = new Set<string>();
  const counts = { tbd: 0, required: 0, manual_review: 0, ready: 0 };

  for (const row of allCatalog) {
    agencies.add(row.agencyCode);

    const triggers = Array.isArray(row.triggeringHsChapters)
      ? (row.triggeringHsChapters as number[])
      : [];
    const triggered = triggers.length === 0 || triggers.includes(chapter);

    const annotation = annotationByCode.get(row.code) ?? null;
    const applies = annotation ? annotation.llmConfirmed : triggered;
    const severity = normalizeSeverity(
      annotation?.severityOverride ?? row.defaultSeverity,
    );

    const { status, reason } = deriveEntryStatus({
      triggered,
      applies,
      severity,
      annotationStatus: annotation?.status ?? null,
      catalogStatus: row.status,
    });

    counts[status]++;

    entries.push({
      catalog_code: row.code,
      title: row.title,
      form_number: row.formNumber,
      description: row.description,
      url: row.url,
      type: row.type,
      jurisdiction: row.jurisdiction,
      agency_code: row.agencyCode,
      agency_name:
        row.agency.name || AGENCY_NAMES[row.agencyCode] || row.agencyCode,
      triggering_hs_chapters: triggers,
      default_severity: row.defaultSeverity,
      triggered,
      applies,
      rationale:
        annotation?.rationale ?? (triggered ? "" : `Not triggered by HS chapter ${chapter}`),
      severity,
      status,
      reason: annotation?.rationale && applies ? annotation.rationale : reason,
      annotation_status: annotation?.status ?? null,
      annotation_source: annotation?.source ?? null,
      note: annotation?.note ?? null,
    });
  }

  const warnings = await buildWarnings(input, dest);
  const overall = deriveOverall(annotations);

  return {
    status: overall.status,
    source: overall.source,
    confidence: overall.confidence,
    destination_country: dest,
    origin_country: (input.originCountry ?? "ANY").toUpperCase(),
    warnings,
    updated_at: new Date().toISOString(),
    verified_at: overall.verifiedAt,

    catalog_entries: entries,
    counts,
    agencies_reviewed: agencies.size,
    total_regulations: allCatalog.length,
  };
}

function deriveOverall(annotations: CatalogAnnotation[]): {
  status: RequirementStatus;
  source: RequirementSource;
  confidence: number | null;
  verifiedAt: string | null;
} {
  if (annotations.length === 0) {
    return {
      status: "flow_validating",
      source: "llm",
      confidence: null,
      verifiedAt: null,
    };
  }
  const allVerified = annotations.every((a) => a.status === "verified");
  const anyOverride = annotations.some((a) => a.status === "manual_override");
  const status: RequirementStatus = anyOverride
    ? "manual_override"
    : allVerified
      ? "verified"
      : "flow_validating";
  const withConfidence = annotations.filter(
    (a): a is CatalogAnnotation & { confidence: number } =>
      a.confidence != null,
  );
  const confidence =
    withConfidence.length > 0
      ? Math.round(
          withConfidence.reduce((acc, a) => acc + a.confidence, 0) /
            withConfidence.length,
        )
      : null;
  const firstSource = annotations[0]?.source ?? "llm";
  const verifiedAt = annotations
    .filter((a) => a.verifiedAt)
    .map((a) => a.verifiedAt)
    .sort()
    .pop() ?? null;
  return { status, source: firstSource, confidence, verifiedAt };
}

async function buildWarnings(
  input: AnnotationInput,
  dest: string,
): Promise<RequirementWarning[]> {
  // v2 surfaces no freehand warnings today — the rationale on each entry
  // carries the per-row "why." Keep an empty list rather than silently
  // dropping the field so the envelope shape is unchanged.
  void input;
  void dest;
  return [];
}
