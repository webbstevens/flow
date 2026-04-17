"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

interface Classification {
  hs_code: string;
  mid_code: string;
  confidence_score: number;
  requires_review: boolean;
  country_of_origin: string;
  materials: string;
  restricted_goods_flag: boolean;
  product_description_for_customs: string;
  ai_attributes: Record<string, string>;
  record_id: string;
  image_url: string | null;
}

interface HistoryItem {
  id: string;
  product_url: string | null;
  source_title: string | null;
  image_url: string | null;
  hs_code: string;
  mid_code: string | null;
  confidence_score: number;
  requires_review: boolean;
  country_of_origin: string | null;
  materials: string | null;
  restricted_goods_flag: boolean;
  product_description_for_customs: string | null;
  ai_attributes: Record<string, string> | null;
  created_at: string;
}

type Mode = "url" | "photo";

export default function ClassifyPage() {
  const [mode, setMode] = useState<Mode>("url");
  const [url, setUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Classification | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);

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

  function openHistoryItem(item: HistoryItem) {
    setResult({
      hs_code: item.hs_code,
      mid_code: item.mid_code ?? "",
      confidence_score: item.confidence_score,
      requires_review: item.requires_review,
      country_of_origin: item.country_of_origin ?? "",
      materials: item.materials ?? "",
      restricted_goods_flag: item.restricted_goods_flag,
      product_description_for_customs:
        item.product_description_for_customs ?? "",
      ai_attributes: item.ai_attributes ?? {},
      record_id: item.id,
      image_url: item.image_url,
    });
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
                key={item.id}
                onClick={() => openHistoryItem(item)}
                className="text-left bg-surface-lowest rounded-2xl overflow-hidden hover:ring-2 hover:ring-accent transition"
              >
                {item.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.image_url}
                    alt={item.source_title ?? "Evaluated product"}
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
                    {item.hs_code}
                  </p>
                  <p className="font-sans text-xs text-primary/60 truncate mt-1">
                    {item.source_title ?? item.product_url ?? "Photo upload"}
                  </p>
                  <Link
                    href={`/analytics/${item.id}`}
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
  result: Classification;
  onReset: () => void;
}) {
  const extraAttrs = Object.entries(result.ai_attributes ?? {});
  return (
    <section className="bg-surface-lowest rounded-3xl p-8 space-y-6">
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
          {result.hs_code}
        </p>
        {result.mid_code && (
          <p className="font-sans text-xs text-primary/60 mt-2">
            MID: {result.mid_code}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <span
          className={`font-sans text-[0.6875rem] font-bold uppercase tracking-widest px-3 py-1 rounded-full ${
            result.confidence_score >= 70
              ? "bg-secondary text-on-secondary"
              : "bg-amber-100 text-amber-900"
          }`}
        >
          {result.confidence_score}% confidence
        </span>
        {result.requires_review && (
          <span className="font-sans text-[0.6875rem] font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-amber-100 text-amber-900">
            Needs review
          </span>
        )}
        {result.restricted_goods_flag && (
          <span className="font-sans text-[0.6875rem] font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-red-100 text-red-900">
            Restricted goods
          </span>
        )}
      </div>

      <div className="space-y-3">
        <p className="font-sans text-[0.6875rem] font-bold uppercase tracking-widest text-primary/60">
          Compliance Details
        </p>
        <ComplianceRow label="Country of Origin" value={result.country_of_origin} />
        <ComplianceRow label="Materials" value={result.materials} />
        <ComplianceRow
          label="Customs Description"
          value={result.product_description_for_customs}
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
