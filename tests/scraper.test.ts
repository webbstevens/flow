import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── fetch mock helpers ───────────────────────────────────────────────────────

function htmlResponse(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function imageResponse(status = 200) {
  return new Response(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), {
    status,
    headers: { "content-type": "image/jpeg" },
  });
}

// ─── module import (after mock setup) ────────────────────────────────────────

// We import after each test's fetch mock is established via globalThis.fetch.
// The scraper calls fetch() at runtime, not at import time, so this is safe.
import {
  scrapeProductUrl,
  downloadImage,
  parseDataUrl,
} from "@/lib/scraper";

// ─── scrapeProductUrl ─────────────────────────────────────────────────────────

describe("scrapeProductUrl", () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("extracts title from <title> tag when no og/JSON-LD", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      htmlResponse(`<html><head><title>Blue Widget</title></head></html>`)
    );
    const result = await scrapeProductUrl("https://example.com/p");
    expect(result.title).toBe("Blue Widget");
  });

  it("prefers og:title over <title> tag", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      htmlResponse(`<html><head>
        <title>Fallback</title>
        <meta property="og:title" content="OG Widget" />
      </head></html>`)
    );
    const result = await scrapeProductUrl("https://example.com/p");
    expect(result.title).toBe("OG Widget");
  });

  it("prefers JSON-LD name over og:title", async () => {
    const ld = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Product",
      name: "JSON-LD Widget",
    });
    vi.mocked(fetch).mockResolvedValueOnce(
      htmlResponse(`<html><head>
        <meta property="og:title" content="OG Widget" />
        <script type="application/ld+json">${ld}</script>
      </head></html>`)
    );
    const result = await scrapeProductUrl("https://example.com/p");
    expect(result.title).toBe("JSON-LD Widget");
  });

  it("extracts brand from JSON-LD brand.name (nested object)", async () => {
    const ld = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Product",
      name: "Widget",
      brand: { "@type": "Brand", name: "Acme Corp" },
    });
    vi.mocked(fetch).mockResolvedValueOnce(
      htmlResponse(
        `<html><head><script type="application/ld+json">${ld}</script></head></html>`
      )
    );
    const result = await scrapeProductUrl("https://example.com/p");
    expect(result.brand).toBe("Acme Corp");
  });

  it("absolutizes a relative image URL against the base URL", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      htmlResponse(`<html><head>
        <meta property="og:image" content="/images/foo.jpg" />
      </head></html>`)
    );
    const result = await scrapeProductUrl("https://example.com/p");
    expect(result.imageUrl).toBe("https://example.com/images/foo.jpg");
  });

  it("returns undefined optional fields and preserves sourceUrl on an empty page", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(htmlResponse(`<html></html>`));
    const result = await scrapeProductUrl("https://example.com/p");
    expect(result.title).toBeUndefined();
    expect(result.description).toBeUndefined();
    expect(result.brand).toBeUndefined();
    expect(result.imageUrl).toBeUndefined();
    expect(result.sourceUrl).toBe("https://example.com/p");
  });

  it("extracts og:description and og:image correctly", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      htmlResponse(`<html><head>
        <meta property="og:title" content="Widget" />
        <meta property="og:description" content="Great product" />
        <meta property="og:image" content="https://cdn.example.com/img.jpg" />
      </head></html>`)
    );
    const result = await scrapeProductUrl("https://example.com/p");
    expect(result.description).toBe("Great product");
    expect(result.imageUrl).toBe("https://cdn.example.com/img.jpg");
  });

  it("throws an actionable error on 403 mentioning the hostname and Photo mode", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response("Forbidden", { status: 403 })
    );
    await expect(scrapeProductUrl("https://www.ebay.co.uk/itm/123")).rejects.toThrow(
      /www\.ebay\.co\.uk.*blocked.*Photo mode/i
    );
  });

  it("throws an actionable error on 429 with the same guidance", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response("Rate limited", { status: 429 })
    );
    await expect(scrapeProductUrl("https://shop.example.com/p")).rejects.toThrow(
      /blocked.*Photo mode/i
    );
  });

  it("throws on non-HTML content-type mentioning the actual content-type", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ error: "not html" })
    );
    await expect(scrapeProductUrl("https://example.com/api")).rejects.toThrow(
      /content-type/i
    );
  });

  it("throws when HTML response exceeds the 5 MB size limit", async () => {
    const bigHtml = "x".repeat(5 * 1024 * 1024 + 1);
    vi.mocked(fetch).mockResolvedValueOnce(htmlResponse(bigHtml));
    await expect(scrapeProductUrl("https://example.com/p")).rejects.toThrow(
      /size limit/i
    );
  });

  it("handles JSON-LD with @graph wrapper", async () => {
    const ld = JSON.stringify({
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "WebPage", name: "Not a product" },
        { "@type": "Product", name: "Graph Widget", brand: "Graph Brand" },
      ],
    });
    vi.mocked(fetch).mockResolvedValueOnce(
      htmlResponse(
        `<html><head><script type="application/ld+json">${ld}</script></head></html>`
      )
    );
    const result = await scrapeProductUrl("https://example.com/p");
    expect(result.title).toBe("Graph Widget");
  });

  it("handles JSON-LD with image as an array", async () => {
    const ld = JSON.stringify({
      "@type": "Product",
      name: "Widget",
      image: [
        "https://cdn.example.com/img1.jpg",
        "https://cdn.example.com/img2.jpg",
      ],
    });
    vi.mocked(fetch).mockResolvedValueOnce(
      htmlResponse(
        `<html><head><script type="application/ld+json">${ld}</script></head></html>`
      )
    );
    const result = await scrapeProductUrl("https://example.com/p");
    expect(result.imageUrl).toBe("https://cdn.example.com/img1.jpg");
  });
});

// ─── parseDataUrl ─────────────────────────────────────────────────────────────

describe("parseDataUrl", () => {
  it("parses a valid JPEG data URL into buffer + contentType", () => {
    const data = "data:image/jpeg;base64,/9j/abc123";
    const result = parseDataUrl(data);
    expect(result).not.toBeNull();
    expect(result!.contentType).toBe("image/jpeg");
    expect(result!.buffer).toBeInstanceOf(Buffer);
  });

  it("parses a valid PNG data URL", () => {
    const data = "data:image/png;base64,iVBORw==";
    const result = parseDataUrl(data);
    expect(result!.contentType).toBe("image/png");
  });

  it("returns null for a non-data URL string", () => {
    expect(parseDataUrl("https://example.com/img.jpg")).toBeNull();
  });

  it("returns null for a malformed data URL missing base64 marker", () => {
    expect(parseDataUrl("data:image/jpeg,notbase64encoded")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(parseDataUrl("")).toBeNull();
  });
});

// ─── downloadImage ────────────────────────────────────────────────────────────

describe("downloadImage", () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns buffer and contentType for a successful JPEG download", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(imageResponse());
    const result = await downloadImage("https://cdn.example.com/img.jpg");
    expect(result.contentType).toBe("image/jpeg");
    expect(result.buffer.length).toBeGreaterThan(0);
  });

  it("strips charset suffix from content-type", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(new Uint8Array([0xff, 0xd8]), {
        status: 200,
        headers: { "content-type": "image/webp; charset=utf-8" },
      })
    );
    const result = await downloadImage("https://cdn.example.com/img.webp");
    expect(result.contentType).toBe("image/webp");
  });

  it("throws on non-image content-type", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(htmlResponse("<html/>"));
    await expect(downloadImage("https://cdn.example.com/img.jpg")).rejects.toThrow(
      /content-type/i
    );
  });

  it("throws when download returns a non-200 status", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response("Not found", { status: 404 })
    );
    await expect(downloadImage("https://cdn.example.com/img.jpg")).rejects.toThrow(
      /404/
    );
  });
});
