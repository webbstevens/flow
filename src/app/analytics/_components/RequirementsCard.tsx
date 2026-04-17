import type { RequirementEnvelope } from "@/lib/requirements";
import {
  groupEntriesByAgency,
  type UnifiedEnvelope,
  type CatalogEntry,
  type AgencyGroup,
} from "@/lib/requirements-v2";

/**
 * Sidebar card that lists customs documentation for the record's destination.
 * Single agency-grouped list driven by the catalog + per-lane annotations
 * (Option C refactor — #15).
 */
export function RequirementsCard({ unified }: { unified: UnifiedEnvelope }) {
  return (
    <section className="bg-surface-lowest rounded-2xl p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <p className="font-sans text-[0.6875rem] font-bold uppercase tracking-widest text-primary/50">
          Required documentation
        </p>
        <StatusPill status={unified.status} source={unified.source} />
      </div>

      <DocReviewBar unified={unified} />

      <div className="flex items-baseline justify-between gap-4 pb-3 border-b border-surface-container">
        <span className="font-sans text-xs text-primary/60">Destination</span>
        <span className="font-sans text-sm text-primary font-mono">
          {unified.destination_country}
        </span>
      </div>

      <UnifiedList entries={unified.catalog_entries} />

      {unified.warnings.length > 0 && (
        <div className="mt-4 pt-4 border-t border-surface-container">
          {unified.warnings.map((w) => (
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
              <AgencyExpander key={a.code} agency={a} defaultOpen />
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
              <AgencyExpander key={a.code} agency={a} />
            ))}
          </ul>
        </details>
      )}
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

function DocReviewBar({ unified }: { unified: UnifiedEnvelope }) {
  const { tbd, required, manual_review, ready } = unified.counts;
  const subtitle = `${unified.total_regulations} regulations across ${unified.agencies_reviewed} agencies reviewed`;

  return (
    <div className="mb-4">
      <p className="font-sans text-[0.6875rem] text-primary/40 mb-2">
        {subtitle}
      </p>
      <div className="grid grid-cols-4 gap-1.5">
        <ReviewPill count={tbd} label="TBD" color="gray" />
        <ReviewPill count={required} label="Required" color="red" />
        <ReviewPill count={manual_review} label="Manual review" color="yellow" />
        <ReviewPill count={ready} label="Ready" color="green" />
      </div>
    </div>
  );
}

function AgencyExpander({
  agency,
  defaultOpen = false,
}: {
  agency: AgencyGroup;
  defaultOpen?: boolean;
}) {
  return (
    <li>
      <details
        className="group/agency rounded-lg bg-surface-container"
        {...(defaultOpen ? { open: true } : {})}
      >
        <summary className="cursor-pointer list-none flex items-center gap-2 px-2 py-2">
          <StatusDot status={agency.worst} />
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
          <MiniCounts counts={agency.counts} />
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
              <StatusDot status={e.status} />
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

function MiniCounts({
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

function StatusDot({ status }: { status: CatalogEntry["status"] }) {
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
