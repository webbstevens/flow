import { describe, it, expect } from "vitest";
import { classifyRequestSchema } from "@/lib/validation";

describe("classifyRequestSchema — POST /v1/compliance/classify contract", () => {
  it("accepts a bare title", () => {
    const r = classifyRequestSchema.safeParse({ title: "Cotton tee" });
    expect(r.success).toBe(true);
  });

  it("accepts a bare productUrl", () => {
    const r = classifyRequestSchema.safeParse({
      productUrl: "https://example.com/tee",
    });
    expect(r.success).toBe(true);
  });

  it("normalizes bare-domain productUrl to https://", () => {
    const r = classifyRequestSchema.safeParse({
      productUrl: "example.com/tee",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.productUrl).toBe("https://example.com/tee");
    }
  });

  it("accepts images-only when no title/url", () => {
    const r = classifyRequestSchema.safeParse({
      images: ["data:image/jpeg;base64,abc"],
    });
    expect(r.success).toBe(true);
  });

  it("rejects an empty payload (no title, url, or images)", () => {
    const r = classifyRequestSchema.safeParse({});
    expect(r.success).toBe(false);
  });

  it("rejects a payload with only an empty images array", () => {
    const r = classifyRequestSchema.safeParse({ images: [] });
    expect(r.success).toBe(false);
  });

  it("uppercases ISO2 country codes", () => {
    const r = classifyRequestSchema.safeParse({
      title: "Cotton tee",
      originCountry: "cn",
      destinationCountry: "us",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.originCountry).toBe("CN");
      expect(r.data.destinationCountry).toBe("US");
    }
  });

  it("rejects non-2-letter country codes", () => {
    const r = classifyRequestSchema.safeParse({
      title: "Cotton tee",
      destinationCountry: "USA",
    });
    expect(r.success).toBe(false);
  });

  it("rejects malformed productUrl after https prefix", () => {
    const r = classifyRequestSchema.safeParse({
      productUrl: "not a url at all",
    });
    expect(r.success).toBe(false);
  });

  it("rejects non-uuid productId", () => {
    const r = classifyRequestSchema.safeParse({
      title: "Cotton tee",
      productId: "not-a-uuid",
    });
    expect(r.success).toBe(false);
  });
});
