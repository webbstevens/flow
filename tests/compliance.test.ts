import { describe, it, expect } from "vitest";
import {
  deriveCompliance,
  buildClassificationEnvelope,
  type RawClassificationRecord,
} from "@/lib/compliance";

const happyRecord: RawClassificationRecord = {
  id: "00000000-0000-0000-0000-000000000001",
  hsCode: "6109.10.0012",
  midCode: "MIDCN12345",
  countryOfOrigin: "CN",
  materials: "100% cotton",
  customsDescription: "Men's knitted t-shirt",
  confidenceScore: 92,
  requiresReview: false,
  restrictedGoodsFlag: false,
  aiAttributes: { material: "Cotton" },
  productUrl: "https://example.com/tee",
  sourceTitle: "Cotton Tee",
  createdAt: new Date("2026-04-17T12:00:00Z"),
  imageUrl: "https://example.com/tee.jpg",
};

describe("deriveCompliance", () => {
  it("compliant when hs is valid, coo is ISO2, and requires_review=false", () => {
    const r = deriveCompliance({
      hsCode: "6109.10.0012",
      countryOfOrigin: "CN",
      confidenceScore: 95,
      requiresReview: false,
      restrictedGoodsFlag: false,
    });
    expect(r.status).toBe("compliant");
    expect(r.missing_required_fields).toEqual([]);
    expect(r.warnings).toEqual([]);
  });

  it("partial when hs_code is missing", () => {
    const r = deriveCompliance({
      hsCode: null,
      countryOfOrigin: "CN",
      confidenceScore: 95,
      requiresReview: false,
      restrictedGoodsFlag: false,
    });
    expect(r.status).toBe("partially_compliant");
    expect(r.missing_required_fields).toContain("hs_code");
  });

  it("partial when hs_code has too few digits", () => {
    const r = deriveCompliance({
      hsCode: "6109",
      countryOfOrigin: "CN",
      confidenceScore: 95,
      requiresReview: false,
      restrictedGoodsFlag: false,
    });
    expect(r.missing_required_fields).toContain("hs_code");
  });

  it("partial when country_of_origin is not ISO2", () => {
    const r = deriveCompliance({
      hsCode: "6109.10.0012",
      countryOfOrigin: "CHN",
      confidenceScore: 95,
      requiresReview: false,
      restrictedGoodsFlag: false,
    });
    expect(r.missing_required_fields).toContain("country_of_origin");
  });

  it("partial when requires_review is true even if fields are valid", () => {
    const r = deriveCompliance({
      hsCode: "6109.10.0012",
      countryOfOrigin: "CN",
      confidenceScore: 95,
      requiresReview: true,
      restrictedGoodsFlag: false,
    });
    expect(r.status).toBe("partially_compliant");
  });

  it("emits LOW_CONFIDENCE warning below 80%", () => {
    const r = deriveCompliance({
      hsCode: "6109.10.0012",
      countryOfOrigin: "CN",
      confidenceScore: 75,
      requiresReview: false,
      restrictedGoodsFlag: false,
    });
    expect(r.warnings.map((w) => w.code)).toContain("LOW_CONFIDENCE");
  });

  it("emits RESTRICTED_GOODS warning when flag is set", () => {
    const r = deriveCompliance({
      hsCode: "6109.10.0012",
      countryOfOrigin: "CN",
      confidenceScore: 95,
      requiresReview: false,
      restrictedGoodsFlag: true,
    });
    expect(r.warnings.map((w) => w.code)).toContain("RESTRICTED_GOODS");
  });
});

describe("buildClassificationEnvelope", () => {
  it("returns a compliant envelope for a happy-path record", () => {
    const env = buildClassificationEnvelope(happyRecord);
    expect(env.classification_id).toBe(happyRecord.id);
    expect(env.compliance_status).toBe("compliant");
    expect(env.classification.hs_code).toBe("6109.10.0012");
    expect(env.classification.coo).toBe("CN");
    expect(env.ai_metadata.confidence_score).toBe(92);
    expect(env.actionable_flags.missing_required_fields).toEqual([]);
    expect(env.source.product_url).toBe("https://example.com/tee");
    expect(env.created_at).toBe("2026-04-17T12:00:00.000Z");
    expect(env.documentation).toBeNull();
  });

  it("carries through a documentation envelope when passed", () => {
    const env = buildClassificationEnvelope(happyRecord, {
      status: "flow_validating",
      source: "llm",
      confidence: 80,
      destination_country: "US",
      origin_country: "CN",
      warnings: [],
      updated_at: "2026-04-17T12:00:00Z",
      verified_at: null,
    });
    expect(env.documentation?.destination_country).toBe("US");
  });

  it("defaults ai_attributes to {} when the record has null", () => {
    const env = buildClassificationEnvelope({ ...happyRecord, aiAttributes: null });
    expect(env.ai_metadata.attributes).toEqual({});
  });

  it("propagates partial status + missing fields into actionable_flags", () => {
    const env = buildClassificationEnvelope({
      ...happyRecord,
      hsCode: "61",
      countryOfOrigin: null,
    });
    expect(env.compliance_status).toBe("partially_compliant");
    expect(env.actionable_flags.missing_required_fields).toEqual(
      expect.arrayContaining(["hs_code", "country_of_origin"]),
    );
  });
});
