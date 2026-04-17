import type {
  RequirementEnvelope,
  RequiredDocument,
} from "@/lib/requirements";
import type { DeepReviewResult, DeepReviewEntry } from "@/lib/deep-review";
import type { UnifiedEnvelope, CatalogEntry } from "@/lib/requirements-v2";

/**
 * Sidebar card that lists customs documentation for the record's destination.
 *
 * Two rendering modes:
 *   - v2 (unified): single agency-grouped list driven by the catalog +
 *     annotations. No top "Required / One of" duplication.
 *   - legacy: original top list + collapsible deep-review drawer.
 *
 * The v1 branch will be removed in PR 4 once REQUIREMENTS_V2 flips in
 * prod; until then the two paths live side-by-side for safe rollback.
 */
export function RequirementsCard({
  documentation,
  deepReview,
  unified,
}: {
  documentation: RequirementEnvelope;
  deepReview?: DeepReviewResult | null;
  unified?: UnifiedEnvelope | null;
}) {
  return (
    <section className="bg-surface-lowest rounded-2xl p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <p className="font-sans text-[0.6875rem] font-bold uppercase tracking-widest text-primary/50">
          Required documentation
        </p>
        <StatusPill
          status={documentation.status}
          source={documentation.source}
        />
      </div>

      <DocReviewBar documentation={documentation} deepReview={deepReview} unified={unified} />

      <div className="flex items-baseline justify-between gap-4 pb-3 border-b border-surface-container">
        <span className="font-sans text-xs text-primary/60">Destination</span>
        <span className="font-sans text-sm text-primary font-mono">
          {documentation.destination_country}
        </span>
      </div>

      {unified ? (
        <UnifiedList entries={unified.catalog_entries} />
      ) : (
        <LegacyList documentation={documentation} deepReview={deepReview} />
      )}

      {documentation.warnings.length > 0 && (
        <div className="mt-4 pt-4 border-t border-surface-container">
          {documentation.warnings.map((w) => (
            <p
              key={w.code}
              className="font-sans text-xs text-amber-800 leading-snug"
            >
              <span className="font-mono text-[0.6875rem] mr-1">{w.code}:</span>
              {w.message}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}

function LegacyList({
  documentation,
  deepReview,
}: {
  documentation: RequirementEnvelope;
  deepReview?: DeepReviewResult | null;
}) {
  const required = documentation.required_documents.filter(
    (d) => d.severity === "required",
  );
  const alternatives = documentation.required_documents.filter(
    (d) => d.severity === "alternative",
  );
  const informational = documentation.required_documents.filter(
    (d) => d.severity === "informational",
  );

  return (
    <>
      {documentation.required_documents.length === 0 ? (
        <p className="font-sans text-sm text-primary/60 mt-4">
          No documentation requirements identified.
        </p>
      ) : (
        <div className="space-y-4 mt-4">
          {required.length > 0 && <DocGroup label="Required" docs={required} />}
          {alternatives.length > 0 && (
            <DocGroup
              label="One of"
              docs={alternatives}
              hint="Submit a positive permit OR a negative declaration."
            />
          )}
          {informational.length > 0 && (
            <DocGroup label="Informational" docs={informational} />
          )}
        </div>
      )}

      {deepReview && <DeepReviewDrawer review={deepReview} />}
    </>
  );
}

function UnifiedList({ entries }: { entries: CatalogEntry[] }) {
  const agencies = groupEntriesByAgency(entries);
  const actionAgencies = agencies.filter((a) => a.actionCount > 0);
  const readyAgencies = agencies.filter((a) => a.actionCount === 0);

  return (
    <div className="mt-4 space-y-4">
      {actionAgencies.length > 0 && (
        <div>
          <p className="font-sans text-[0.6875rem] font-bold uppercase tracking-widest text-primary/50 mb-2">
            Needs attention
          </p>
          <ul className="space-y-1">
            {actionAgencies.map((a) => (
              <UnifiedAgencyExpander key={a.code} agency={a} defaultOpen />
            ))}
          </ul>
        </div>
      )}

      {readyAgencies.length > 0 && (
        <details className="pt-2 border-t border-surface-container group">
          <summary className="cursor-pointer list-none flex items-center justify-between font-sans text-[0.6875rem] font-bold uppercase tracking-widest text-primary/50 hover:text-primary transition py-2">
            <span>Ready · {readyAgencies.length} agencies</span>
            <span className="material-symbols-outlined text-sm group-open:rotate-180 transition">
              expand_more
            </span>
          </summary>
          <ul className="space-y-1 mt-2">
            {readyAgencies.map((a) => (
              <UnifiedAgencyExpander key={a.code} agency={a} />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function DocGroup({
  label,
  docs,
  hint,
}: {
  label: string;
  docs: RequiredDocument[];
  hint?: string;
}) {
  return (
    <div>
      <p className="font-sans text-[0.6875rem] font-bold uppercase tracking-widest text-primary/50 mb-2">
        {label}
      </p>
      {hint && (
        <p className="font-sans text-xs text-primary/60 mb-2 italic">{hint}</p>
      )}
      <ul className="space-y-2">
        {docs.map((d) => (
          <li
            key={d.certificate_code}
            className="bg-surface-container rounded-xl px-3 py-2"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-sans text-sm text-primary leading-snug">
                  {d.name}
                </p>
                <p className="font-mono text-[0.6875rem] text-primary/60 mt-0.5">
                  {d.certificate_code}
                  {d.agency !== "NONE" && (
                    <>
                      {" · "}
                      <span className="text-primary/50">{d.agency_name}</span>
                    </>
                  )}
                </p>
              </div>
              <TypeBadge type={d.type} />
            </div>
            {d.note && (
              <p className="font-sans text-xs text-primary/70 mt-1 leading-snug">
                {d.note}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function StatusPill({
  status,
  source,
}: {
  status: RequirementEnvelope["status"];
  source: RequirementEnvelope["source"];
}) {
  if (status === "verified") {
    return (
      <span className="font-sans text-[0.6875rem] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-secondary text-on-secondary">
        Verified · {formatSource(source)}
      </span>
    );
  }
  if (status === "manual_override") {
    return (
      <span className="font-sans text-[0.6875rem] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-surface-container text-primary">
        Edited
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 font-sans text-[0.6875rem] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-amber-100 text-amber-900">
      <span className="relative flex h-1.5 w-1.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75" />
        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-600" />
      </span>
      Flow validating
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  const label: Record<string, string> = {
    C: "Cert",
    L: "Licence",
    U: "Origin",
    X: "Export",
    N: "Doc",
    Y: "Y-decl",
    PGA: "PGA",
  };
  return (
    <span className="font-sans text-[0.625rem] font-bold uppercase tracking-wider text-primary/50 bg-surface-lowest rounded px-1.5 py-0.5 flex-shrink-0">
      {label[type] ?? type}
    </span>
  );
}

function DocReviewBar({
  documentation,
  deepReview,
  unified,
}: {
  documentation: RequirementEnvelope;
  deepReview?: DeepReviewResult | null;
  unified?: UnifiedEnvelope | null;
}) {
  let gray: number, red: number, yellow: number, green: number;
  let subtitle: string;

  if (unified) {
    gray = unified.counts.tbd;
    red = unified.counts.required;
    yellow = unified.counts.manual_review;
    green = unified.counts.ready;
    subtitle = `${unified.total_regulations} regulations across ${unified.agencies_reviewed} agencies reviewed`;
  } else if (deepReview) {
    gray = deepReview.counts.tbd;
    red = deepReview.counts.required;
    yellow = deepReview.counts.manualReview;
    green = deepReview.counts.ready;
    subtitle = `${deepReview.totalRegulations} regulations across ${deepReview.agenciesReviewed} agencies reviewed`;
  } else {
    const docs = documentation.required_documents;
    gray = red = yellow = green = 0;
    if (documentation.status === "flow_validating") {
      gray = docs.length;
    } else {
      for (const doc of docs) {
        if (doc.severity === "required") red++;
        else if (doc.severity === "alternative") yellow++;
        else green++;
      }
    }
    subtitle = `${docs.length} document${docs.length !== 1 ? "s" : ""} assessed`;
  }

  return (
    <div className="mb-4">
      <p className="font-sans text-[0.6875rem] text-primary/40 mb-2">
        {subtitle}
      </p>
      <div className="grid grid-cols-4 gap-1.5">
        <ReviewPill count={gray} label="TBD" color="gray" />
        <ReviewPill count={red} label="Required" color="red" />
        <ReviewPill count={yellow} label="Manual review" color="yellow" />
        <ReviewPill count={green} label="Ready" color="green" />
      </div>
    </div>
  );
}

function DeepReviewDrawer({ review }: { review: DeepReviewResult }) {
  const agencies = groupByAgency(review.entries);

  return (
    <details className="mt-4 pt-4 border-t border-surface-container group">
      <summary className="cursor-pointer list-none flex items-center justify-between font-sans text-[0.6875rem] font-bold uppercase tracking-widest text-primary/50 hover:text-primary transition">
        <span>Full regulatory review · {agencies.length} agencies</span>
        <span className="material-symbols-outlined text-sm group-open:rotate-180 transition">
          expand_more
        </span>
      </summary>
      <p className="font-sans text-[0.625rem] text-primary/40 mt-2 mb-3 leading-snug">
        Grouped by agency — action-needed first. HS chapter {review.hsChapter}.
      </p>
      <ul className="space-y-1">
        {agencies.map((a) => (
          <AgencyExpander key={a.code} agency={a} />
        ))}
      </ul>
    </details>
  );
}

interface AgencyGroup {
  code: string;
  name: string;
  entries: DeepReviewEntry[];
  worst: DeepReviewEntry["status"];
  counts: Record<DeepReviewEntry["status"], number>;
}

function groupByAgency(entries: DeepReviewEntry[]): AgencyGroup[] {
  const rank: Record<DeepReviewEntry["status"], number> = {
    required: 0,
    manual_review: 1,
    tbd: 2,
    ready: 3,
  };

  const byCode = new Map<string, DeepReviewEntry[]>();
  for (const e of entries) {
    const existing = byCode.get(e.agencyCode);
    if (existing) existing.push(e);
    else byCode.set(e.agencyCode, [e]);
  }

  const groups: AgencyGroup[] = [];
  for (const [code, rows] of byCode) {
    const counts: Record<DeepReviewEntry["status"], number> = {
      tbd: 0,
      required: 0,
      manual_review: 0,
      ready: 0,
    };
    let worst: DeepReviewEntry["status"] = "ready";
    for (const r of rows) {
      counts[r.status]++;
      if (rank[r.status] < rank[worst]) worst = r.status;
    }
    groups.push({ code, name: rows[0].agencyName, entries: rows, worst, counts });
  }

  return groups.sort(
    (a, b) =>
      rank[a.worst] - rank[b.worst] ||
      b.entries.length - a.entries.length ||
      a.name.localeCompare(b.name),
  );
}

function AgencyExpander({ agency }: { agency: AgencyGroup }) {
  const actionCount =
    agency.counts.required + agency.counts.manual_review + agency.counts.tbd;

  return (
    <li>
      <details className="group/agency rounded-lg bg-surface-container">
        <summary className="cursor-pointer list-none flex items-center gap-2 px-2 py-2">
          <StatusDot status={agency.worst} />
          <div className="min-w-0 flex-1">
            <p className="font-sans text-xs text-primary leading-snug truncate">
              {agency.name}
            </p>
            <p className="font-mono text-[0.625rem] text-primary/50 mt-0.5">
              {agency.code} · {agency.entries.length} rule
              {agency.entries.length !== 1 ? "s" : ""}
              {actionCount > 0 && (
                <>
                  {" · "}
                  <span className="text-primary/70">
                    {actionCount} needs attention
                  </span>
                </>
              )}
            </p>
          </div>
          <MiniCounts counts={agency.counts} />
          <span className="material-symbols-outlined text-sm text-primary/40 group-open/agency:rotate-180 transition">
            expand_more
          </span>
        </summary>
        <ul className="px-2 pb-2 pt-1 space-y-1 border-t border-surface-lowest">
          {agency.entries.map((e) => (
            <li
              key={e.catalogCode}
              className="flex items-start gap-2 px-1.5 py-1"
            >
              <StatusDot status={e.status} />
              <div className="min-w-0 flex-1">
                <p
                  className={`font-sans text-xs leading-snug ${e.triggered ? "text-primary" : "text-primary/50"}`}
                >
                  {e.title}
                </p>
                <p className="font-mono text-[0.625rem] text-primary/50 mt-0.5">
                  {e.catalogCode}
                </p>
                <p className="font-sans text-[0.625rem] text-primary/50 mt-0.5 italic leading-snug">
                  {e.reason}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </details>
    </li>
  );
}

function MiniCounts({
  counts,
}: {
  counts: Record<DeepReviewEntry["status"], number>;
}) {
  const items: Array<{ n: number; color: string; label: string }> = [
    { n: counts.required, color: "bg-red-500", label: "required" },
    { n: counts.manual_review, color: "bg-amber-500", label: "manual review" },
    { n: counts.tbd, color: "bg-primary/30", label: "tbd" },
    { n: counts.ready, color: "bg-green-500", label: "ready" },
  ].filter((x) => x.n > 0);

  return (
    <div className="flex items-center gap-1 flex-shrink-0">
      {items.map((item) => (
        <span
          key={item.label}
          title={`${item.n} ${item.label}`}
          className="inline-flex items-center gap-1 font-sans text-[0.625rem] text-primary/60"
        >
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${item.color}`} />
          {item.n}
        </span>
      ))}
    </div>
  );
}

function StatusDot({ status }: { status: DeepReviewEntry["status"] }) {
  const colors: Record<DeepReviewEntry["status"], string> = {
    tbd: "bg-primary/30",
    required: "bg-red-500",
    manual_review: "bg-amber-500",
    ready: "bg-green-500",
  };
  return (
    <span
      className={`mt-1 inline-block h-2 w-2 rounded-full flex-shrink-0 ${colors[status]}`}
    />
  );
}

function ReviewPill({
  count,
  label,
  color,
}: {
  count: number;
  label: string;
  color: "gray" | "red" | "yellow" | "green";
}) {
  const styles: Record<typeof color, string> = {
    gray: "bg-surface-container text-primary/50",
    red: "bg-red-100 text-red-900",
    yellow: "bg-amber-100 text-amber-900",
    green: "bg-green-100 text-green-800",
  };

  return (
    <div
      className={`rounded-xl px-2 py-2 flex flex-col items-center gap-0.5 ${styles[color]}`}
    >
      <span className="font-sans text-base font-bold leading-none">{count}</span>
      <span className="font-sans text-[0.5625rem] font-bold uppercase tracking-wide leading-tight text-center">
        {label}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Unified (v2) grouping — one list, catalog + annotations.
// ---------------------------------------------------------------------------

interface UnifiedAgencyGroup {
  code: string;
  name: string;
  entries: CatalogEntry[];
  worst: CatalogEntry["status"];
  counts: Record<CatalogEntry["status"], number>;
  actionCount: number;
}

const UNIFIED_STATUS_RANK: Record<CatalogEntry["status"], number> = {
  required: 0,
  manual_review: 1,
  tbd: 2,
  ready: 3,
};

function groupEntriesByAgency(entries: CatalogEntry[]): UnifiedAgencyGroup[] {
  const byCode = new Map<string, CatalogEntry[]>();
  for (const e of entries) {
    const existing = byCode.get(e.agency_code);
    if (existing) existing.push(e);
    else byCode.set(e.agency_code, [e]);
  }

  const groups: UnifiedAgencyGroup[] = [];
  for (const [code, rows] of byCode) {
    const counts: Record<CatalogEntry["status"], number> = {
      tbd: 0,
      required: 0,
      manual_review: 0,
      ready: 0,
    };
    let worst: CatalogEntry["status"] = "ready";
    for (const r of rows) {
      counts[r.status]++;
      if (UNIFIED_STATUS_RANK[r.status] < UNIFIED_STATUS_RANK[worst]) {
        worst = r.status;
      }
    }
    groups.push({
      code,
      name: rows[0].agency_name,
      entries: rows,
      worst,
      counts,
      actionCount: counts.required + counts.manual_review + counts.tbd,
    });
  }

  return groups.sort(
    (a, b) =>
      UNIFIED_STATUS_RANK[a.worst] - UNIFIED_STATUS_RANK[b.worst] ||
      b.actionCount - a.actionCount ||
      a.name.localeCompare(b.name),
  );
}

function UnifiedAgencyExpander({
  agency,
  defaultOpen = false,
}: {
  agency: UnifiedAgencyGroup;
  defaultOpen?: boolean;
}) {
  return (
    <li>
      <details
        className="group/agency rounded-lg bg-surface-container"
        {...(defaultOpen ? { open: true } : {})}
      >
        <summary className="cursor-pointer list-none flex items-center gap-2 px-2 py-2">
          <UnifiedStatusDot status={agency.worst} />
          <div className="min-w-0 flex-1">
            <p className="font-sans text-xs text-primary leading-snug truncate">
              {agency.name}
            </p>
            <p className="font-mono text-[0.625rem] text-primary/50 mt-0.5">
              {agency.code} · {agency.entries.length} rule
              {agency.entries.length !== 1 ? "s" : ""}
              {agency.actionCount > 0 && (
                <>
                  {" · "}
                  <span className="text-primary/70">
                    {agency.actionCount} needs attention
                  </span>
                </>
              )}
            </p>
          </div>
          <UnifiedMiniCounts counts={agency.counts} />
          <span className="material-symbols-outlined text-sm text-primary/40 group-open/agency:rotate-180 transition">
            expand_more
          </span>
        </summary>
        <ul className="px-2 pb-2 pt-1 space-y-1 border-t border-surface-lowest">
          {agency.entries.map((e) => (
            <li
              key={e.catalog_code}
              className="flex items-start gap-2 px-1.5 py-1"
            >
              <UnifiedStatusDot status={e.status} />
              <div className="min-w-0 flex-1">
                <p
                  className={`font-sans text-xs leading-snug ${
                    e.applies ? "text-primary" : "text-primary/50"
                  }`}
                >
                  {e.title}
                </p>
                <p className="font-mono text-[0.625rem] text-primary/50 mt-0.5">
                  {e.catalog_code}
                </p>
                {e.reason && (
                  <p className="font-sans text-[0.625rem] text-primary/50 mt-0.5 italic leading-snug">
                    {e.reason}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </details>
    </li>
  );
}

function UnifiedMiniCounts({
  counts,
}: {
  counts: Record<CatalogEntry["status"], number>;
}) {
  const items: Array<{ n: number; color: string; label: string }> = [
    { n: counts.required, color: "bg-red-500", label: "required" },
    { n: counts.manual_review, color: "bg-amber-500", label: "manual review" },
    { n: counts.tbd, color: "bg-primary/30", label: "tbd" },
    { n: counts.ready, color: "bg-green-500", label: "ready" },
  ].filter((x) => x.n > 0);

  return (
    <div className="flex items-center gap-1 flex-shrink-0">
      {items.map((item) => (
        <span
          key={item.label}
          title={`${item.n} ${item.label}`}
          className="inline-flex items-center gap-1 font-sans text-[0.625rem] text-primary/60"
        >
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${item.color}`} />
          {item.n}
        </span>
      ))}
    </div>
  );
}

function UnifiedStatusDot({ status }: { status: CatalogEntry["status"] }) {
  const colors: Record<CatalogEntry["status"], string> = {
    tbd: "bg-primary/30",
    required: "bg-red-500",
    manual_review: "bg-amber-500",
    ready: "bg-green-500",
  };
  return (
    <span
      className={`mt-1 inline-block h-2 w-2 rounded-full flex-shrink-0 ${colors[status]}`}
    />
  );
}

function formatSource(source: RequirementEnvelope["source"]): string {
  switch (source) {
    case "uk_trade_tariff":
      return "UK Trade Tariff";
    case "taric":
      return "EU TARIC";
    case "ace":
      return "US ACE";
    case "manual":
      return "Manual";
    default:
      return "AI";
  }
}
