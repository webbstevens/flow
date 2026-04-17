"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ComplianceBadge } from "./ComplianceBadge";

export interface RecordRow {
  id: string;
  imageUrl: string | null;
  hsCode: string;
  title: string | null;
  productUrl: string | null;
  confidenceScore: number;
  requiresReview: boolean;
  restrictedGoodsFlag: boolean;
  countryOfOrigin: string | null;
  createdAt: string;
}

type Filter = "all" | "needs_review" | "restricted" | "high_confidence";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "needs_review", label: "Needs Review" },
  { key: "restricted", label: "Restricted" },
  { key: "high_confidence", label: "High Confidence" },
];

export function RecordsTable({ rows }: { rows: RecordRow[] }) {
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = useMemo(() => {
    switch (filter) {
      case "needs_review":
        return rows.filter((r) => r.requiresReview);
      case "restricted":
        return rows.filter((r) => r.restrictedGoodsFlag);
      case "high_confidence":
        return rows.filter((r) => r.confidenceScore >= 90);
      default:
        return rows;
    }
  }, [filter, rows]);

  if (rows.length === 0) {
    return <EmptyState />;
  }

  return (
    <section>
      {/* Filter pills */}
      <div className="flex flex-wrap gap-2 mb-6">
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`font-sans text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full transition ${
                active
                  ? "bg-primary text-white"
                  : "bg-surface-lowest text-primary/70 hover:text-primary"
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-surface-lowest rounded-2xl p-8 text-center">
          <p className="font-sans text-sm text-primary/60">
            No records match this filter.
          </p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-surface-lowest rounded-3xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="text-left">
                  <th className="px-6 py-4 font-sans text-[0.6875rem] font-bold uppercase tracking-widest text-primary/50 w-20"></th>
                  <th className="px-6 py-4 font-sans text-[0.6875rem] font-bold uppercase tracking-widest text-primary/50">
                    HS Code
                  </th>
                  <th className="px-6 py-4 font-sans text-[0.6875rem] font-bold uppercase tracking-widest text-primary/50">
                    Product
                  </th>
                  <th className="px-6 py-4 font-sans text-[0.6875rem] font-bold uppercase tracking-widest text-primary/50">
                    Status
                  </th>
                  <th className="px-6 py-4 font-sans text-[0.6875rem] font-bold uppercase tracking-widest text-primary/50 text-right">
                    Evaluated
                  </th>
                  <th className="pr-6 py-4 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr
                    key={r.id}
                    className="border-t border-surface-container hover:bg-surface-container/50 transition group"
                  >
                    <td className="px-6 py-4">
                      <Thumb url={r.imageUrl} />
                    </td>
                    <td className="px-6 py-4">
                      <Link
                        href={`/analytics/${r.id}`}
                        className="font-mono text-sm text-primary hover:text-accent"
                      >
                        {r.hsCode}
                      </Link>
                    </td>
                    <td className="px-6 py-4 max-w-xs">
                      <Link
                        href={`/analytics/${r.id}`}
                        className="block font-sans text-sm text-primary truncate hover:text-accent"
                      >
                        {r.title ?? r.productUrl ?? "—"}
                      </Link>
                      {r.countryOfOrigin && (
                        <p className="font-sans text-xs text-primary/50 mt-0.5">
                          Origin: {r.countryOfOrigin}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        <ComplianceBadge kind="confidence" confidence={r.confidenceScore} />
                        {r.requiresReview && <ComplianceBadge kind="needs_review" />}
                        {r.restrictedGoodsFlag && <ComplianceBadge kind="restricted" />}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-sans text-xs text-primary/60 whitespace-nowrap">
                      {formatDate(r.createdAt)}
                    </td>
                    <td className="pr-6 py-4">
                      <Link
                        href={`/analytics/${r.id}`}
                        aria-label="View details"
                        className="inline-flex text-primary/40 group-hover:text-accent transition"
                      >
                        <span className="material-symbols-outlined text-lg">
                          arrow_forward
                        </span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="md:hidden space-y-3">
            {filtered.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/analytics/${r.id}`}
                  className="flex gap-4 bg-surface-lowest rounded-2xl p-4 hover:bg-surface-container transition"
                >
                  <Thumb url={r.imageUrl} />
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-sm text-primary">{r.hsCode}</p>
                    <p className="font-sans text-sm text-primary/80 truncate mt-1">
                      {r.title ?? r.productUrl ?? "—"}
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <ComplianceBadge kind="confidence" confidence={r.confidenceScore} />
                      {r.requiresReview && <ComplianceBadge kind="needs_review" />}
                      {r.restrictedGoodsFlag && <ComplianceBadge kind="restricted" />}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function Thumb({ url }: { url: string | null }) {
  if (!url) {
    return (
      <div className="w-12 h-12 rounded-lg bg-surface-container flex items-center justify-center flex-shrink-0">
        <span className="material-symbols-outlined text-primary/30 text-lg">
          image
        </span>
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
    />
  );
}

function EmptyState() {
  return (
    <section className="bg-surface-lowest rounded-3xl p-12 text-center">
      <p className="font-serif italic text-2xl text-primary mb-2">
        No classifications yet
      </p>
      <p className="font-sans text-sm text-primary/60 mb-6">
        Drop a product URL into the classifier to see it here.
      </p>
      <Link
        href="/classify"
        className="inline-flex bg-primary text-white px-8 py-3 rounded-full text-xs font-bold uppercase tracking-widest hover:opacity-90 transition"
      >
        Start Classifying
      </Link>
    </section>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
