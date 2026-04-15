"use client";

import { ApiReferenceReact } from "@scalar/api-reference-react";
import "@scalar/api-reference-react/style.css";

export default function DocsPage() {
  return (
    <main className="max-w-7xl mx-auto px-0 md:px-6">
      <header className="px-6 md:px-0 mb-8 mt-2">
        <p className="text-[0.6875rem] font-bold uppercase tracking-widest text-accent">
          Flow · Reference
        </p>
        <h1 className="font-serif italic text-[2.25rem] leading-[1.1] mt-3 text-primary">
          API Reference
        </h1>
        <p className="text-sm text-on-surface-variant mt-4 max-w-lg">
          Every endpoint, every schema, generated from the OpenAPI spec.
          Download at{" "}
          <a
            className="text-accent underline"
            href="/api/openapi"
            target="_blank"
            rel="noopener noreferrer"
          >
            /api/openapi
          </a>
          .
        </p>
      </header>

      <div className="bg-surface-lowest md:rounded-3xl overflow-hidden">
        <ApiReferenceReact
          configuration={{
            url: "/api/openapi",
            theme: "default",
            layout: "modern",
            hideDarkModeToggle: true,
            hideClientButton: false,
          }}
        />
      </div>
    </main>
  );
}
