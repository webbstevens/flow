"use client";

import { useState } from "react";
import type { RequirementEnvelope } from "@/lib/requirements";
import type { UnifiedEnvelope } from "@/lib/requirements-v2";
import {
  groupEntriesByStatus,
  type CatalogEntry,
  type EntryStatus,
} from "@/lib/requirement-groups";

/**
 * Sidebar card that lists customs documentation for the record's destination.
 * Four chips (Required · TBD · Manual review · Ready) in RGYG order, each an
 * accordion that expands a flat list of entries with an agency badge on each
 * row. Only one bucket open at a time; all collapsed on first render.
 */
export function RequirementsCard({ unified }: { unified: UnifiedEnvelope }) {
  const buckets = groupEntriesByStatus(unified.catalog_entries);
  const [openStatus, setOpenStatus] = useState<EntryStatus | null>(null);

  return (
    <section className="bg-surface-lowest rounded-2xl p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <p className="font-sans text-[0.6875rem] font-bold uppercase tracking-widest text-primary/50">
          Required documentation
        </p>
        <StatusPill status={unified.status} source={unified.source} />
      </div>

      <p className="font-sans text-sm text-primary/70 leading-snug mb-4">
        Flow checked{" "}
        <span className="font-semibold text-primary">
          {unified.total_regulations} regulation
          {unified.total_regulations !== 1 ? "s" : ""}
        </span>{" "}
        across{" "}
        <span className="font-semibold text-primary">
          {unified.agencies_reviewed} agenc
          {unified.agencies_reviewed !== 1 ? "ies" : "y"}
        </span>{" "}
        for this lane.
      </p>

      <div className="flex items-baseline justify-between gap-4 pb-3 mb-3 border-b border-surface-container">
        <span className="font-sans text-xs text-primary/60">Destination</span>
        <span className="font-sans text-sm text-primary font-mono">
          {unified.destination_country}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
        {buckets.map((b) => (
          <StatusChip
            key={b.status}
            status={b.status}
            count={b.entries.length}
            open={openStatus === b.status}
            onToggle={() =>
              setOpenStatus((prev) => (prev === b.status ? null : b.status))
            }
          />
        ))}
      </div>

      {openStatus && (
        <BucketPanel
          entries={
            buckets.find((b) => b.status === openStatus)?.entries ?? []
          }
        />
      )}

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

const STATUS_LABEL: Record<EntryStatus, string> = {
  required: "Required",
  tbd: "TBD",
  manual_review: "Manual review",
  ready: "Ready",
};

const STATUS_CHIP_STYLE: Record<
  EntryStatus,
  { base: string; open: string; dot: string }
> = {
  required: {
    base: "bg-red-50 text-red-900 hover:bg-red-100",
    open: "bg-red-100 ring-2 ring-red-500",
    dot: "bg-red-500",
  },
  tbd: {
    base: "bg-surface-container text-primary/70 hover:bg-surface-container-high",
    open: "bg-surface-container-high ring-2 ring-primary/40",
    dot: "bg-primary/40",
  },
  manual_review: {
    base: "bg-amber-50 text-amber-900 hover:bg-amber-100",
    open: "bg-amber-100 ring-2 ring-amber-500",
    dot: "bg-amber-500",
  },
  ready: {
    base: "bg-green-50 text-green-900 hover:bg-green-100",
    open: "bg-green-100 ring-2 ring-green-500",
    dot: "bg-green-500",
  },
};

function StatusChip({
  status,
  count,
  open,
  onToggle,
}: {
  status: EntryStatus;
  count: number;
  open: boolean;
  onToggle: () => void;
}) {
  const styles = STATUS_CHIP_STYLE[status];
  const disabled = count === 0;
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-expanded={open}
      className={`rounded-xl px-2 py-2 flex flex-col items-center gap-0.5 transition focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-inherit ${
        open ? styles.open : styles.base
      }`}
    >
      <span className="font-sans text-base font-bold leading-none">{count}</span>
      <span className="font-sans text-[0.5625rem] font-bold uppercase tracking-wide leading-tight text-center">
        {STATUS_LABEL[status]}
      </span>
    </button>
  );
}

function BucketPanel({
  entries,
}: {
  entries: CatalogEntry[];
}) {
  if (entries.length === 0) return null;
  return (
    <ul className="mt-3 space-y-1 border-t border-surface-container pt-3">
      {entries.map((e) => (
        <EntryRow key={e.catalog_code} entry={e} />
      ))}
    </ul>
  );
}

function EntryRow({ entry }: { entry: CatalogEntry }) {
  return (
    <li className="rounded-lg bg-surface-container">
      <details className="group/entry">
        <summary className="cursor-pointer list-none flex items-start gap-2 px-2 py-2">
          <StatusDot status={entry.status} />
          <div className="min-w-0 flex-1">
            <p
              className={`font-sans text-xs leading-snug ${
                entry.applies ? "text-primary" : "text-primary/50"
              }`}
            >
              {entry.title}
            </p>
            <p className="font-mono text-[0.625rem] text-primary/50 mt-0.5">
              <span title={entry.agency_name}>{entry.agency_code}</span>
              {" · "}
              {entry.catalog_code}
            </p>
          </div>
          <span className="material-symbols-outlined text-sm text-primary/40 group-open/entry:rotate-180 transition">
            expand_more
          </span>
        </summary>
        <div className="px-3 pb-3 pt-1 border-t border-surface-lowest space-y-1.5">
          <p className="font-sans text-[0.6875rem] text-primary/70 leading-snug">
            <span className="font-mono text-primary/50 mr-1">Agency:</span>
            {entry.agency_name}
          </p>
          {entry.reason && (
            <p className="font-sans text-[0.6875rem] text-primary/70 italic leading-snug">
              {entry.reason}
            </p>
          )}
          {entry.url && (
            <a
              href={entry.url}
              target="_blank"
              rel="noreferrer"
              className="inline-block font-sans text-[0.6875rem] text-primary underline underline-offset-2 hover:text-primary/70"
            >
              Reference →
            </a>
          )}
        </div>
      </details>
    </li>
  );
}

function StatusDot({ status }: { status: EntryStatus }) {
  const dot = STATUS_CHIP_STYLE[status].dot;
  return (
    <span
      className={`mt-1 inline-block h-2 w-2 rounded-full flex-shrink-0 ${dot}`}
    />
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
