"use client";

import { useRef, useState } from "react";

interface Classification {
  hs_code: string;
  mid_code: string;
  confidence_score: number;
  requires_review: boolean;
  ai_attributes: Record<string, string>;
}

export default function Home() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Classification | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  async function handleClassify() {
    if (!imageDataUrl) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/v1/compliance/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: [imageDataUrl] }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.message || "Classification failed");
      }
      setResult(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setImageDataUrl(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <main className="flex-1 flex flex-col px-6 pt-12 pb-10 max-w-xl mx-auto w-full">
      {/* Hero */}
      <header className="mb-10">
        <p className="font-sans text-[0.6875rem] font-bold uppercase tracking-widest text-accent">
          Flow · Compliance Engine
        </p>
        <h1 className="font-serif text-[2.25rem] leading-[1.1] mt-3 text-primary">
          Snap. Classify.<br />Ship.
        </h1>
        <p className="font-sans text-sm text-primary/70 mt-4 max-w-md">
          Take a photo of your product. We&apos;ll return the HTSUS classification in seconds.
        </p>
      </header>

      {/* Capture or preview */}
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
            style={{
              backgroundImage:
                "linear-gradient(180deg, #1f2937 0%, rgba(31,41,55,0.85) 100%)",
            }}
          >
            Take Photo
          </button>
        )}
      </section>

      {/* Submit */}
      {imageDataUrl && !result && (
        <section className="mb-8">
          <button
            onClick={handleClassify}
            disabled={loading}
            className="w-full bg-secondary text-on-secondary rounded-full py-5 font-sans font-medium text-base disabled:opacity-50 active:opacity-90 transition"
          >
            {loading ? "Classifying…" : "Classify"}
          </button>

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
      {result && (
        <section className="bg-surface-lowest rounded-3xl p-8 space-y-6">
          <div>
            <p className="font-sans text-[0.6875rem] font-bold uppercase tracking-widest text-primary/60">
              HTSUS Code
            </p>
            <p className="font-serif text-[3rem] leading-none mt-3 text-primary tracking-tight">
              {result.hs_code}
            </p>
          </div>

          <div className="flex items-center gap-3">
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
          </div>

          {Object.keys(result.ai_attributes).length > 0 && (
            <div>
              <p className="font-sans text-[0.6875rem] font-bold uppercase tracking-widest text-primary/60 mb-3">
                Attributes
              </p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(result.ai_attributes).map(([k, v]) => (
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
            onClick={reset}
            className="w-full mt-2 font-sans text-sm text-accent hover:underline"
          >
            Classify another
          </button>
        </section>
      )}
    </main>
  );
}
