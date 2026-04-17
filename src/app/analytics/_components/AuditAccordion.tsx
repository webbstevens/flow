"use client";

import { useState } from "react";
import type {
  RationaleEnvelope,
  GriStep,
  NoteReview,
} from "@/lib/rationale";
import type { PrecedentsEnvelope } from "@/lib/precedents";

type LifecycleStatus = "flow_validating" | "verified" | "manual_override";

/**
 * Shared accordion shell. Collapsed by default. On first expand, fetches
 * from `fetchUrl`; subsequent expands reuse the loaded payload. If an
 * `initial` payload is provided (warm from the Server Component via
 * `findCachedRationale` etc.), no fetch is made — the accordion opens on
 * an already-populated body.
 */
function Accordion<T>({
  title,
  subtitle,
  fetchUrl,
  initial,
  renderBody,
}: {
  title: string;
  subtitle: string;
  fetchUrl: string;
  initial: T | null;
  renderBody: (data: T) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<T | null>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && data === null && !loading) {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(fetchUrl);
        const body = (await res.json()) as
          | { status: "success"; data: T }
          | { error: true; message: string };
        if ("error" in body) {
          setError(body.message);
        } else {
          setData(body.data);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Request failed");
      } finally {
        setLoading(false);
      }
    }
  }

  return (
    <section className="bg-surface-lowest rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-6 py-4 text-left hover:bg-surface-container/40 transition"
      >
        <span>
          <span className="font-sans text-[0.6875rem] font-bold uppercase tracking-widest text-primary/50 block">
            {title}
          </span>
          <span className="font-sans text-sm text-primary/70 mt-0.5 block">
            {subtitle}
          </span>
        </span>
        <span
          className={`material-symbols-outlined text-primary/60 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        >
          expand_more
        </span>
      </button>
      {open && (
        <div className="px-6 pb-6 border-t border-surface-container">
          {loading && (
            <p className="font-sans text-sm text-primary/60 mt-4">Loading…</p>
          )}
          {error && (
            <p className="font-sans text-sm text-red-700 mt-4">
              Could not load: {error}
            </p>
          )}
          {data && <div className="mt-4">{renderBody(data)}</div>}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Rationale
// ---------------------------------------------------------------------------

export function RationaleAccordion({
  recordId,
  initial,
}: {
  recordId: string;
  initial: RationaleEnvelope | null;
}) {
  return (
    <Accordion<RationaleEnvelope>
      title="Why this classification?"
      subtitle="GRI step analysis and section/chapter notes reviewed."
      fetchUrl={`/api/v1/compliance/classify/${recordId}/rationale`}
      initial={initial}
      renderBody={(data) => <RationaleBody data={data} />}
    />
  );
}

function RationaleBody({ data }: { data: RationaleEnvelope }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <LifecyclePill status={data.status} />
        {data.confidence !== null && (
          <span className="font-sans text-[0.6875rem] font-bold uppercase tracking-widest text-primary/50">
            Confidence {data.confidence}
          </span>
        )}
      </div>

      {data.gri_steps.length === 0 ? (
        <p className="font-sans text-sm text-primary/60">
          No GRI steps were recorded for this classification.
        </p>
      ) : (
        <ol className="space-y-3">
          {data.gri_steps.map((step, idx) => (
            <GriStepRow key={idx} step={step} index={idx + 1} />
          ))}
        </ol>
      )}

      {data.notes_reviewed.length > 0 && (
        <div className="pt-4 border-t border-surface-container">
          <p className="font-sans text-[0.6875rem] font-bold uppercase tracking-widest text-primary/50 mb-2">
            Notes reviewed
          </p>
          <ul className="space-y-2">
            {data.notes_reviewed.map((n, idx) => (
              <NoteRow key={idx} note={n} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function GriStepRow({ step, index }: { step: GriStep; index: number }) {
  return (
    <li className="bg-surface-container rounded-xl px-4 py-3">
      <div className="flex items-start gap-3">
        <span className="font-serif italic text-primary/40 text-lg leading-none mt-0.5">
          {index}.
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs bg-surface-lowest rounded px-2 py-0.5 text-primary">
              {step.rule}
            </span>
            <span className="font-sans text-[0.625rem] font-bold uppercase tracking-wider text-primary/50">
              {formatOutcome(step.outcome)}
            </span>
          </div>
          <p className="font-sans text-sm text-primary/80 mt-2 leading-snug">
            {step.reasoning}
          </p>
        </div>
      </div>
    </li>
  );
}

function NoteRow({ note }: { note: NoteReview }) {
  return (
    <li className="bg-surface-container rounded-xl px-4 py-3">
      <div className="flex items-center gap-2 flex-wrap mb-1.5">
        <span className="font-mono text-[0.6875rem] text-primary/60">
          {note.scope.replace(/_/g, " ")}
        </span>
        <span className="font-sans text-[0.625rem] font-bold uppercase tracking-wider text-primary/50">
          {formatRelevance(note.relevance)}
        </span>
      </div>
      <p className="font-serif italic text-sm text-primary/80 leading-snug">
        &ldquo;{note.text_excerpt}&rdquo;
      </p>
    </li>
  );
}

function formatOutcome(o: GriStep["outcome"]): string {
  switch (o) {
    case "provisional_classification":
      return "Provisional";
    case "subheading_selected":
      return "Subheading set";
    case "heading_eliminated":
      return "Heading eliminated";
    case "disambiguated":
      return "Disambiguated";
  }
}

function formatRelevance(r: NoteReview["relevance"]): string {
  switch (r) {
    case "confirms_inclusion":
      return "Confirms inclusion";
    case "confirms_exclusion":
      return "Confirms exclusion";
    case "clarifies_definition":
      return "Clarifies";
  }
}

// ---------------------------------------------------------------------------
// Precedents
// ---------------------------------------------------------------------------

export function PrecedentsAccordion({
  recordId,
  initial,
}: {
  recordId: string;
  initial: PrecedentsEnvelope | null;
}) {
  return (
    <Accordion<PrecedentsEnvelope>
      title="Similar CROSS rulings"
      subtitle="CBP ruling precedents for this HS subheading."
      fetchUrl={`/api/v1/compliance/classify/${recordId}/precedents`}
      initial={initial}
      renderBody={(data) => <PrecedentsBody data={data} />}
    />
  );
}

function PrecedentsBody({ data }: { data: PrecedentsEnvelope }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <LifecyclePill status={data.status} />
        <span className="font-sans text-[0.6875rem] font-bold uppercase tracking-widest text-primary/50">
          Source · {formatPrecedentsSource(data.source)}
        </span>
      </div>

      {data.rulings.length === 0 ? (
        <p className="font-sans text-sm text-primary/70 bg-surface-container rounded-xl px-4 py-3 leading-snug">
          {data.notice ??
            "No ruling precedents returned for this product and HS subheading."}
        </p>
      ) : (
        <ul className="space-y-2">
          {data.rulings.map((r) => (
            <li
              key={r.ruling_number}
              className="bg-surface-container rounded-xl px-4 py-3"
            >
              <div className="flex items-center justify-between gap-3">
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-sm text-accent hover:underline"
                >
                  {r.ruling_number}
                </a>
                <span className="font-sans text-xs text-primary/50">
                  {r.date}
                </span>
              </div>
              <p className="font-sans text-sm text-primary/80 mt-1 leading-snug">
                {r.product}
              </p>
              <p className="font-mono text-[0.6875rem] text-primary/50 mt-1">
                {r.hs_code} · relevance {r.relevance}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatPrecedentsSource(s: PrecedentsEnvelope["source"]): string {
  switch (s) {
    case "cross_stub":
      return "Closed beta";
    case "cross_scrape":
      return "CROSS scrape";
    case "cross_api":
      return "CROSS API";
  }
}

// ---------------------------------------------------------------------------
// Shared lifecycle pill (matches RequirementsCard)
// ---------------------------------------------------------------------------

function LifecyclePill({ status }: { status: LifecycleStatus }) {
  if (status === "verified") {
    return (
      <span className="font-sans text-[0.6875rem] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-secondary text-on-secondary">
        Verified
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
