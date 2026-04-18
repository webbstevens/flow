/**
 * Pure types + grouping helpers for the Requirements UI.
 *
 * Split out of `requirements-v2.ts` so client components can import these
 * without pulling in prisma (which transitively imports `pg` → `dns` and
 * breaks the browser bundle).
 */

import type { DocumentSeverity } from "@/lib/requirements";

export type EntryStatus = "tbd" | "required" | "manual_review" | "ready";

export type AnnotationStatus =
  | "flow_validating"
  | "verified"
  | "manual_override";

export type AnnotationSource = "llm" | "manual" | "ace" | "taric" | "uk_trade_tariff";

export interface CatalogEntry {
  catalog_code: string;
  title: string;
  form_number: string | null;
  description: string;
  url: string | null;
  type: string;
  jurisdiction: string;
  agency_code: string;
  agency_name: string;
  triggering_hs_chapters: number[];
  default_severity: string;

  triggered: boolean;
  applies: boolean;
  rationale: string;
  severity: DocumentSeverity;
  status: EntryStatus;
  reason: string;
  annotation_status: AnnotationStatus | null;
  annotation_source: AnnotationSource | null;
  note: string | null;
}

export interface StatusBucket {
  status: EntryStatus;
  entries: CatalogEntry[];
}

/**
 * Groups catalog entries into the 4 GRYG buckets used by the Requirements
 * card on the analytics detail page. Order follows the chip layout (RGYG):
 * Required → TBD → Manual review → Ready. Within a bucket entries sort by
 * agency code, then rule title.
 */
export function groupEntriesByStatus(entries: CatalogEntry[]): StatusBucket[] {
  const buckets: Record<EntryStatus, CatalogEntry[]> = {
    required: [],
    tbd: [],
    manual_review: [],
    ready: [],
  };
  for (const e of entries) buckets[e.status].push(e);
  for (const list of Object.values(buckets)) {
    list.sort(
      (a, b) =>
        a.agency_code.localeCompare(b.agency_code) ||
        a.title.localeCompare(b.title),
    );
  }
  return [
    { status: "required", entries: buckets.required },
    { status: "tbd", entries: buckets.tbd },
    { status: "manual_review", entries: buckets.manual_review },
    { status: "ready", entries: buckets.ready },
  ];
}

export function normalizeSeverity(raw: string): DocumentSeverity {
  if (raw === "required" || raw === "alternative" || raw === "informational") {
    return raw;
  }
  if (raw === "conditional") return "alternative";
  return "required";
}

export function deriveEntryStatus(args: {
  triggered: boolean;
  applies: boolean;
  severity: DocumentSeverity;
  annotationStatus: AnnotationStatus | null;
  catalogStatus: string;
}): { status: EntryStatus; reason: string } {
  const { triggered, applies, severity, annotationStatus, catalogStatus } = args;

  if (!triggered) {
    return { status: "ready", reason: "Not applicable to this HS chapter" };
  }
  if (!applies) {
    return {
      status: "ready",
      reason: "Triggered by chapter but not applicable to this product",
    };
  }
  if (catalogStatus === "flow_validating" && annotationStatus !== "verified") {
    return { status: "tbd", reason: "Rule still being validated" };
  }
  if (severity === "informational") {
    return { status: "ready", reason: "Informational only" };
  }
  if (severity === "alternative") {
    return {
      status: "manual_review",
      reason: "One of a set — operator review needed",
    };
  }
  return { status: "required", reason: "Required — no submission on file" };
}
