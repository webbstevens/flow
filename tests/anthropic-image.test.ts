/**
 * Unit tests for Claude image-block construction (src/lib/anthropic.ts).
 *
 * Regression guard for "Only HTTPS URLs are supported." — Anthropic's `url`
 * image source rejects any non-HTTPS scheme, which previously failed the entire
 * classify request when a product page served its image over http://.
 *
 * downloadImage is mocked, so these run with no network and no API key.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/scraper", () => ({
  downloadImage: vi.fn(),
}));

import { toImageBlock } from "@/lib/anthropic";
import { downloadImage } from "@/lib/scraper";

const mockDownload = vi.mocked(downloadImage);

describe("toImageBlock", () => {
  beforeEach(() => mockDownload.mockReset());

  it("inlines a data URL as base64 without any network call", async () => {
    const block = await toImageBlock("data:image/jpeg;base64,AAAA");
    expect(block).toEqual({
      type: "image",
      source: { type: "base64", media_type: "image/jpeg", data: "AAAA" },
    });
    expect(mockDownload).not.toHaveBeenCalled();
  });

  it("passes an HTTPS URL through as a url source", async () => {
    const block = await toImageBlock("https://cdn.example.com/p.jpg");
    expect(block).toEqual({
      type: "image",
      source: { type: "url", url: "https://cdn.example.com/p.jpg" },
    });
    expect(mockDownload).not.toHaveBeenCalled();
  });

  it("fetches an http:// image and inlines it as base64 (not a url source)", async () => {
    mockDownload.mockResolvedValue({
      buffer: Buffer.from("hello"),
      contentType: "image/png",
    });
    const block = await toImageBlock("http://legacy.example.com/p.png");
    expect(mockDownload).toHaveBeenCalledWith("http://legacy.example.com/p.png");
    expect(block).toEqual({
      type: "image",
      source: {
        type: "base64",
        media_type: "image/png",
        data: Buffer.from("hello").toString("base64"),
      },
    });
  });

  it("strips a charset from the content-type before using it as media_type", async () => {
    mockDownload.mockResolvedValue({
      buffer: Buffer.from("x"),
      contentType: "image/webp; charset=binary",
    });
    const block = await toImageBlock("http://legacy.example.com/p.webp");
    expect(block?.source).toMatchObject({ type: "base64", media_type: "image/webp" });
  });

  it("returns null for an image type Claude doesn't accept", async () => {
    mockDownload.mockResolvedValue({
      buffer: Buffer.from("x"),
      contentType: "image/avif",
    });
    expect(await toImageBlock("http://legacy.example.com/p.avif")).toBeNull();
  });
});
