/**
 * Deep regulatory review.
 *
 * For a given (HS code, destination) evaluate every row in
 * `certificate_catalog` and assign it a GRYG status:
 *
 *   TBD           — catalog entry still flow_validating
 *   Required      — triggered + required severity + no submission tracked yet
 *   Manual review — triggered + conditional severity
 *   Ready         — not triggered for this HS chapter, OR informational only
 *
 * Lane model: the catalog is US-import-facing, so this only fires for
 * destination='US'. Origin is not yet used as a trigger (future work —
 * e.g. Lacey Act tightens for high-risk origins).
 */

import { prisma } from "@/lib/prisma";

export type DeepReviewStatus = "tbd" | "required" | "manual_review" | "ready";

export interface DeepReviewEntry {
  catalogCode: string;
  title: string;
  agencyCode: string;
  agencyName: string;
  severity: "required" | "conditional" | "informational";
  triggered: boolean;
  status: DeepReviewStatus;
  reason: string;
}

export interface DeepReviewResult {
  destinationCountry: string;
  hsChapter: number;
  counts: {
    tbd: number;
    required: number;
    manualReview: number;
    ready: number;
  };
  agenciesReviewed: number;
  totalRegulations: number;
  entries: DeepReviewEntry[];
}

export async function computeDeepReview(
  hsCode: string | null,
  destinationCountry: string | null,
): Promise<DeepReviewResult | null> {
  if (destinationCountry !== "US") return null;
  if (!hsCode || hsCode.length < 2) return null;

  const hsChapter = Number.parseInt(hsCode.slice(0, 2), 10);
  if (Number.isNaN(hsChapter)) return null;

  const catalog = await prisma.certificateCatalog.findMany({
    include: { agency: true },
    orderBy: [{ agencyCode: "asc" }, { code: "asc" }],
  });

  if (catalog.length === 0) return null;

  const entries: DeepReviewEntry[] = [];
  const agencies = new Set<string>();
  const counts = { tbd: 0, required: 0, manualReview: 0, ready: 0 };

  for (const row of catalog) {
    agencies.add(row.agencyCode);

    const triggers = Array.isArray(row.triggeringHsChapters)
      ? (row.triggeringHsChapters as number[])
      : [];
    const triggered = triggers.length === 0 || triggers.includes(hsChapter);

    const severity = row.defaultSeverity as DeepReviewEntry["severity"];

    let status: DeepReviewStatus;
    let reason: string;

    if (!triggered) {
      status = "ready";
      reason = `Not applicable to HS chapter ${hsChapter}`;
    } else if (row.status === "flow_validating") {
      status = "tbd";
      reason = "Rule still being validated";
    } else if (severity === "required") {
      status = "required";
      reason = "Required — no submission on file";
    } else if (severity === "conditional") {
      status = "manual_review";
      reason = "Conditional — operator review needed";
    } else {
      status = "ready";
      reason = "Informational";
    }

    if (status === "tbd") counts.tbd++;
    else if (status === "required") counts.required++;
    else if (status === "manual_review") counts.manualReview++;
    else counts.ready++;

    entries.push({
      catalogCode: row.code,
      title: row.title,
      agencyCode: row.agencyCode,
      agencyName: row.agency.name,
      severity,
      triggered,
      status,
      reason,
    });
  }

  return {
    destinationCountry,
    hsChapter,
    counts,
    agenciesReviewed: agencies.size,
    totalRegulations: catalog.length,
    entries,
  };
}
