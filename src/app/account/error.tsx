"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function AccountError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className="max-w-2xl mx-auto px-6 pt-4 pb-10">
      <header className="mb-10">
        <p className="text-[0.6875rem] font-bold uppercase tracking-widest text-accent">
          Flow · Workspace
        </p>
        <h1 className="font-serif italic text-[2.25rem] leading-[1.1] mt-3 text-primary">
          Something went wrong
        </h1>
      </header>

      <section className="bg-surface-lowest rounded-3xl p-8">
        <p className="text-sm text-primary/70 mb-4">
          The workspace page failed to load. This is usually a temporary
          database connection issue.
        </p>

        {error.message && (
          <pre className="bg-surface-container rounded-2xl px-4 py-3 text-xs font-mono text-primary/60 overflow-auto mb-6">
            {error.message}
            {error.digest ? `\n\nDigest: ${error.digest}` : ""}
          </pre>
        )}

        <div className="flex gap-3">
          <button
            onClick={reset}
            className="bg-primary text-white rounded-full px-6 py-3 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition"
          >
            Try again
          </button>
          <a
            href="/account"
            className="bg-surface-container text-primary rounded-full px-6 py-3 text-xs font-bold uppercase tracking-widest hover:opacity-80 transition"
          >
            Reload
          </a>
        </div>
      </section>
    </main>
  );
}
