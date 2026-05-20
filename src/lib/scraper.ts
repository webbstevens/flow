/**
 * Minimal server-side product page scraper.
 * Extracts title, description, brand, and primary image URL from meta tags
 * and JSON-LD structured data. No new dependencies — uses native fetch + regex.
 */

const FETCH_TIMEOUT_MS = 10_000;
const MAX_HTML_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB

// Realistic Chrome UA — many retailers (eBay, Amazon, etc.) block anything
// that declares itself as a bot or uses a non-browser UA string.
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

// Headers a real Chrome browser sends on a navigation request.
const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent": USER_AGENT,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
};

export interface ScrapedProduct {
  title?: string;
  description?: string;
  brand?: string;
  imageUrl?: string;
  sourceUrl: string;
}

export async function scrapeProductUrl(url: string): Promise<ScrapedProduct> {
  const html = await fetchHtml(url);
  const meta = extractMeta(html);
  const jsonLd = extractJsonLdProduct(html);

  // JSON-LD typically has the most accurate product info; fall back to og/meta.
  const title = jsonLd.name ?? meta["og:title"] ?? meta["twitter:title"] ?? extractTitleTag(html);
  const description =
    jsonLd.description ?? meta["og:description"] ?? meta["description"] ?? meta["twitter:description"];
  const brand = jsonLd.brand ?? meta["og:brand"] ?? meta["product:brand"];
  const imageUrl = absolutize(
    jsonLd.image ?? meta["og:image"] ?? meta["og:image:secure_url"] ?? meta["twitter:image"],
    url,
  );

  return {
    title: clean(title),
    description: clean(description),
    brand: clean(brand),
    imageUrl,
    sourceUrl: url,
  };
}

async function fetchHtml(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: BROWSER_HEADERS,
      signal: controller.signal,
      redirect: "follow",
    });
    if (!res.ok) {
      if (res.status === 403 || res.status === 429) {
        throw new Error(
          `${new URL(url).hostname} blocked the request (${res.status}). ` +
          `Try switching to Photo mode — take or upload a photo of the product instead.`
        );
      }
      throw new Error(`Failed to fetch URL (status ${res.status})`);
    }
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("html")) {
      throw new Error(`URL did not return HTML (content-type: ${contentType})`);
    }
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_HTML_BYTES) {
      throw new Error("HTML response exceeds size limit");
    }
    return new TextDecoder("utf-8").decode(buf);
  } finally {
    clearTimeout(timer);
  }
}

function extractMeta(html: string): Record<string, string> {
  const meta: Record<string, string> = {};
  const metaTagRegex = /<meta\s+([^>]+)>/gi;
  let match: RegExpExecArray | null;
  while ((match = metaTagRegex.exec(html)) !== null) {
    const attrs = parseAttributes(match[1]);
    const key = attrs["property"] ?? attrs["name"];
    const value = attrs["content"];
    if (key && value) meta[key.toLowerCase()] = value;
  }
  return meta;
}

function parseAttributes(input: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /(\w[\w:-]*)\s*=\s*"([^"]*)"|(\w[\w:-]*)\s*=\s*'([^']*)'/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(input)) !== null) {
    const key = (m[1] ?? m[3]).toLowerCase();
    attrs[key] = m[2] ?? m[4];
  }
  return attrs;
}

function extractTitleTag(html: string): string | undefined {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m ? m[1].trim() : undefined;
}

interface JsonLdProduct {
  name?: string;
  description?: string;
  brand?: string;
  image?: string;
}

function extractJsonLdProduct(html: string): JsonLdProduct {
  const result: JsonLdProduct = {};
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      const products = flattenJsonLd(parsed);
      for (const p of products) {
        if (!result.name && typeof p.name === "string") result.name = p.name;
        if (!result.description && typeof p.description === "string") {
          result.description = p.description;
        }
        if (!result.brand) {
          if (typeof p.brand === "string") result.brand = p.brand;
          else if (p.brand && typeof p.brand === "object") {
            const brandName = (p.brand as Record<string, unknown>).name;
            if (typeof brandName === "string") result.brand = brandName;
          }
        }
        if (!result.image) {
          if (typeof p.image === "string") result.image = p.image;
          else if (Array.isArray(p.image) && typeof p.image[0] === "string") {
            result.image = p.image[0];
          } else if (p.image && typeof p.image === "object") {
            const imgUrl = (p.image as Record<string, unknown>).url;
            if (typeof imgUrl === "string") result.image = imgUrl;
          }
        }
      }
    } catch {
      // ignore malformed JSON-LD
    }
  }
  return result;
}

function flattenJsonLd(node: unknown): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  const visit = (n: unknown) => {
    if (!n) return;
    if (Array.isArray(n)) {
      for (const item of n) visit(item);
      return;
    }
    if (typeof n === "object") {
      const obj = n as Record<string, unknown>;
      const type = obj["@type"];
      if (type === "Product" || (Array.isArray(type) && type.includes("Product"))) {
        out.push(obj);
      }
      if (Array.isArray(obj["@graph"])) visit(obj["@graph"]);
    }
  };
  visit(node);
  return out;
}

function absolutize(maybeUrl: string | undefined, baseUrl: string): string | undefined {
  if (!maybeUrl) return undefined;
  try {
    return new URL(maybeUrl, baseUrl).toString();
  } catch {
    return undefined;
  }
}

function clean(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export interface DownloadedImage {
  buffer: Buffer;
  contentType: string;
}

export async function downloadImage(url: string): Promise<DownloadedImage> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "image/*" },
      signal: controller.signal,
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`Failed to download image (status ${res.status})`);
    const contentType = (res.headers.get("content-type") ?? "image/jpeg").split(";")[0].trim();
    if (!contentType.startsWith("image/")) {
      throw new Error(`URL did not return an image (content-type: ${contentType})`);
    }
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_IMAGE_BYTES) {
      throw new Error("Image exceeds size limit");
    }
    return { buffer: Buffer.from(buf), contentType };
  } finally {
    clearTimeout(timer);
  }
}

export function parseDataUrl(
  input: string,
): { buffer: Buffer; contentType: string } | null {
  const match = input.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
  if (!match) return null;
  return { contentType: match[1], buffer: Buffer.from(match[2], "base64") };
}
