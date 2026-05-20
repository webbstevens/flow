"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

interface Warning {
  code: "LOW_CONFIDENCE" | "RESTRICTED_GOODS";
  message: string;
}

interface ClassificationEnvelope {
  classification_id: string;
  compliance_status: "compliant" | "partially_compliant";
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
    warnings: Warning[];
    restricted_goods_flag: boolean;
  };
  source: {
    product_url: string | null;
    title: string | null;
  };
  image_url: string | null;
  created_at: string;
}

type Mode = "url" | "photo";

export default function ClassifyPage() {
  // Default to Photo on touch/mobile devices, URL on desktop.
  // Runs after hydration to avoid SSR mismatch.
  const [mode, setMode] = useState<Mode>("url");
  useEffect(() => {
    const isMobile =
      window.matchMedia("(hover: none) and (pointer: coarse)").matches ||
      window.innerWidth < 768;
    if (isMobile) setMode("photo");
  }, []);
  const [url, setUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ClassificationEnvelope | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<ClassificationEnvelope[]>([]);

  useEffect(() => {
    refreshHistory();
  }, []);

  async function refreshHistory() {
    try {
      const res = await fetch("/api/v1/compliance/history?limit=12");
      if (!res.ok) return;
      const json = await res.json();
      setHistory(json.data ?? []);
    } catch {
      /* ignore */
    }
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImageDataUrl(reader.result as string);
      setResult(null);
      setError(null);
    };
    reader.readAsDataURL(file);
  }

  async function submitClassification(payload: Record<string, unknown>) {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/v1/compliance/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.message || "Classification failed");
      }
      setResult(json.data);
      refreshHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function handleUrlSubmit() {
    if (!url.trim()) return;
    submitClassification({ productUrl: url.trim() });
  }

  function handlePhotoSubmit() {
    if (!imageDataUrl) return;
    submitClassification({ images: [imageDataUrl] });
  }

  function reset() {
    setResult(null);
    setError(null);
    setImageDataUrl(null);
    setUrl("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function openHistoryItem(item: ClassificationEnvelope) {
    setResult(item);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  return (
    <main className="flex-1 flex flex-col px-6 pt-12 pb-10 max-w-xl mx-auto w-full">
      {/* Hero */}
      <header className="mb-8">
        <p className="font-sans text-[0.6875rem] font-bold uppercase tracking-widest text-accent">
          Flow · Compliance Engine
        </p>
        <h1 className="font-serif text-[2.25rem] leading-[1.1] mt-3 text-primary">
          Paste. Classify.<br />Ship.
        </h1>
        <p className="font-sans text-sm text-primary/70 mt-4 max-w-md">
          Drop a product page URL. We&apos;ll fetch the details, classify the
          HTSUS code, and flag anything that matters for customs.
        </p>
      </header>

      {/* Mode toggle */}
      <div className="mb-6 inline-flex bg-surface-lowest rounded-full p-1 self-start">
        <button
          onClick={() => {
            setMode("url");
            reset();
          }}
          className={`px-5 py-2 rounded-full font-sans text-xs font-bold uppercase tracking-widest transition ${
            mode === "url"
              ? "bg-primary text-white"
              : "text-primary/60 hover:text-primary"
          }`}
        >
          URL
        </button>
        <button
          onClick={() => {
            setMode("photo");
            reset();
          }}
          className={`px-5 py-2 rounded-full font-sans text-xs font-bold uppercase tracking-widest transition ${
            mode === "photo"
              ? "bg-primary text-white"
              : "text-primary/60 hover:text-primary"
          }`}
        >
          Photo
        </button>
      </div>

      {/* URL mode */}
      {mode === "url" && !result && (
        <section className="mb-8 space-y-4">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.example.com/products/…"
            className="w-full bg-surface-lowest rounded-full px-6 py-4 font-sans text-sm text-primary outline-none focus:ring-2 focus:ring-accent"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleUrlSubmit();
            }}
          />
          <button
            onClick={handleUrlSubmit}
            disabled={loading || !url.trim()}
            className="w-full bg-primary text-white rounded-full py-5 font-sans font-medium text-base disabled:opacity-50 active:opacity-90 transition"
          >
            {loading ? "Classifying…" : "Classify"}
          </button>
          {loading && (
            <div className="h-[2px] rounded-full overflow-hidden bg-surface-container">
              <div className="flow-indicator h-full w-full" />
            </div>
          )}
        </section>
      )}

      {/* Photo mode */}
      {mode === "photo" && !result && (
        <section className="mb-8">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFile}
            className="hidden"
          />

          {imageDataUrl ? (
            <div className="bg-surface-lowest rounded-3xl p-4 space-y-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageDataUrl}
                alt="Captured product"
                className="w-full rounded-2xl object-cover max-h-[60vh]"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="font-sans text-xs font-medium text-accent hover:underline"
              >
                Retake photo
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full bg-primary text-white rounded-full py-5 font-sans font-medium text-base shadow-sm active:opacity-90 transition"
            >
              Take or Choose Photo
            </button>
          )}

          {imageDataUrl && (
            <button
              onClick={handlePhotoSubmit}
              disabled={loading}
              className="mt-4 w-full bg-secondary text-on-secondary rounded-full py-5 font-sans font-medium text-base disabled:opacity-50 active:opacity-90 transition"
            >
              {loading ? "Classifying…" : "Classify"}
            </button>
          )}

          {loading && (
            <div className="mt-4 h-[2px] rounded-full overflow-hidden bg-surface-container">
              <div className="flow-indicator h-full w-full" />
            </div>
          )}
        </section>
      )}

      {/* Error */}
      {error && (
        <section className="mb-8 bg-surface-lowest rounded-2xl p-5">
          <p className="font-sans text-[0.6875rem] font-bold uppercase tracking-widest text-red-700">
            Error
          </p>
          <p className="font-sans text-sm text-primary mt-2">{error}</p>
          {error.includes("blocked") && mode === "url" && (
            <button
              onClick={() => { setMode("photo"); setError(null); }}
              className="mt-3 font-sans text-xs font-bold uppercase tracking-widest text-accent hover:underline"
            >
              Switch to Photo mode →
            </button>
          )}
        </section>
      )}

      {/* Result */}
      {result && <ResultCard result={result} onReset={reset} />}

      {/* History */}
      {history.length > 0 && (
        <section className="mt-12">
          <p className="font-sans text-[0.6875rem] font-bold uppercase tracking-widest text-primary/60 mb-4">
            Recent Evaluations
          </p>
          <div className="grid grid-cols-2 gap-3">
            {history.map((item) => (
              <button
                key={item.classification_id}
                onClick={() => openHistoryItem(item)}
                className="text-left bg-surface-lowest rounded-2xl overflow-hidden hover:ring-2 hover:ring-accent transition"
              >
                {item.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.image_url}
                    alt={item.source.title ?? "Evaluated product"}
                    className="w-full aspect-square object-cover"
                  />
                ) : (
                  <div className="w-full aspect-square bg-surface-container flex items-center justify-center">
                    <span className="font-sans text-[0.6875rem] uppercase tracking-widest text-primary/40">
                      No image
                    </span>
                  </div>
                )}
                <div className="p-3">
                  <p className="font-serif text-base text-primary truncate">
                    {item.classification.hs_code}
                  </p>
                  <p className="font-sans text-xs text-primary/60 truncate mt-1">
                    {item.source.title ?? item.source.product_url ?? "Photo upload"}
                  </p>
                  <Link
                    href={`/analytics/${item.classification_id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-block mt-2 font-sans text-[0.6875rem] font-bold uppercase tracking-widest text-accent hover:underline"
                  >
                    View details →
                  </Link>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function ResultCard({
  result,
  onReset,
}: {
  result: ClassificationEnvelope;
  onReset: () => void;
}) {
  const { classification, ai_metadata, actionable_flags } = result;
  const extraAttrs = Object.entries(ai_metadata.attributes ?? {});
  const partial = result.compliance_status === "partially_compliant";
  return (
    <section className="bg-surface-lowest rounded-3xl p-8 space-y-6">
      {partial && (
        <div className="bg-amber-100 text-amber-900 rounded-2xl px-4 py-3 space-y-1">
          <p className="font-sans text-[0.6875rem] font-bold uppercase tracking-widest">
            Partially compliant
          </p>
          {actionable_flags.missing_required_fields.length > 0 && (
            <p className="font-sans text-sm">
              Missing required field(s):{" "}
              <span className="font-mono">
                {actionable_flags.missing_required_fields.join(", ")}
              </span>
            </p>
          )}
          {actionable_flags.warnings.map((w) => (
            <p key={w.code} className="font-sans text-sm">
              {w.message}
            </p>
          ))}
        </div>
      )}

      {result.image_url && (
        <div>
          <p className="font-sans text-[0.6875rem] font-bold uppercase tracking-widest text-primary/60 mb-3">
            What we evaluated
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={result.image_url}
            alt="Evaluated product"
            className="w-full rounded-2xl object-cover max-h-[40vh]"
          />
        </div>
      )}

      <div>
        <p className="font-sans text-[0.6875rem] font-bold uppercase tracking-widest text-primary/60">
          HTSUS Code
        </p>
        <p className="font-serif text-[3rem] leading-none mt-3 text-primary tracking-tight">
          {classification.hs_code}
        </p>
        {classification.mid_code && (
          <p className="font-sans text-xs text-primary/60 mt-2">
            MID: {classification.mid_code}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <span
          className={`font-sans text-[0.6875rem] font-bold uppercase tracking-widest px-3 py-1 rounded-full ${
            ai_metadata.confidence_score >= 80
              ? "bg-secondary text-on-secondary"
              : "bg-amber-100 text-amber-900"
          }`}
        >
          {ai_metadata.confidence_score}% confidence
        </span>
        {ai_metadata.requires_review && (
          <span className="font-sans text-[0.6875rem] font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-amber-100 text-amber-900">
            Needs review
          </span>
        )}
        {actionable_flags.restricted_goods_flag && (
          <span className="font-sans text-[0.6875rem] font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-red-100 text-red-900">
            Restricted goods
          </span>
        )}
      </div>

      <div className="space-y-3">
        <p className="font-sans text-[0.6875rem] font-bold uppercase tracking-widest text-primary/60">
          Compliance Details
        </p>
        <ComplianceRow label="Country of Origin" value={classification.coo} />
        <ComplianceRow label="Materials" value={classification.materials} />
        <ComplianceRow
          label="Customs Description"
          value={classification.customs_description}
        />
      </div>

      {extraAttrs.length > 0 && (
        <div>
          <p className="font-sans text-[0.6875rem] font-bold uppercase tracking-widest text-primary/60 mb-3">
            Attributes
          </p>
          <div className="flex flex-wrap gap-2">
            {extraAttrs.map(([k, v]) => (
              <span
                key={k}
                className="font-sans text-xs px-3 py-1.5 rounded-full bg-surface-container text-primary"
              >
                <span className="text-primary/60">{k}:</span> {String(v)}
              </span>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={onReset}
        className="w-full mt-2 font-sans text-sm text-accent hover:underline"
      >
        Classify another
      </button>
    </section>
  );
}

function ComplianceRow({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  const display = value && value.length > 0 ? value : "—";
  return (
    <div className="flex justify-between items-start gap-4 border-b border-surface-container last:border-b-0 pb-3 last:pb-0">
      <span className="font-sans text-xs text-primary/60 flex-shrink-0">
        {label}
      </span>
      <span className="font-sans text-sm text-primary text-right">
        {display}
      </span>
    </div>
  );
}
