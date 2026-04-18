import { describe, it, expect } from "vitest";
import {
  normalizeSeverity,
  deriveEntryStatus,
  groupEntriesByStatus,
  type CatalogEntry,
} from "@/lib/requirements-v2";

function makeEntry(overrides: Partial<CatalogEntry>): CatalogEntry {
  return {
    catalog_code: "C400",
    title: "CITES permit",
    form_number: null,
    description: "",
    url: null,
    type: "C",
    jurisdiction: "EU",
    agency_code: "DG_ENV",
    agency_name: "EU DG Environment",
    triggering_hs_chapters: [],
    default_severity: "required",
    triggered: true,
    applies: true,
    rationale: "",
    severity: "required",
    status: "required",
    reason: "",
    annotation_status: null,
    annotation_source: null,
    note: null,
    ...overrides,
  };
}

describe("normalizeSeverity", () => {
  it("passes through 'required'", () => {
    expect(normalizeSeverity("required")).toBe("required");
  });

  it("passes through 'alternative'", () => {
    expect(normalizeSeverity("alternative")).toBe("alternative");
  });

  it("passes through 'informational'", () => {
    expect(normalizeSeverity("informational")).toBe("informational");
  });

  it("maps 'conditional' to 'alternative' at the envelope boundary", () => {
    expect(normalizeSeverity("conditional")).toBe("alternative");
  });

  it("falls back to 'required' for unknown values", () => {
    expect(normalizeSeverity("nonsense")).toBe("required");
  });
});

describe("deriveEntryStatus — GRYG table (docs/compliance.md)", () => {
  it("not triggered by HS chapter → ready", () => {
    const { status, reason } = deriveEntryStatus({
      triggered: false,
      applies: false,
      severity: "required",
      annotationStatus: null,
      catalogStatus: "verified",
    });
    expect(status).toBe("ready");
    expect(reason).toMatch(/not applicable/i);
  });

  it("triggered but LLM says doesn't apply → ready", () => {
    const { status, reason } = deriveEntryStatus({
      triggered: true,
      applies: false,
      severity: "required",
      annotationStatus: "flow_validating",
      catalogStatus: "verified",
    });
    expect(status).toBe("ready");
    expect(reason).toMatch(/not applicable to this product/i);
  });

  it("triggered + flow_validating catalog + non-verified annotation → tbd", () => {
    const { status, reason } = deriveEntryStatus({
      triggered: true,
      applies: true,
      severity: "required",
      annotationStatus: "flow_validating",
      catalogStatus: "flow_validating",
    });
    expect(status).toBe("tbd");
    expect(reason).toMatch(/validated/i);
  });

  it("triggered + flow_validating catalog + verified annotation → falls through (not tbd)", () => {
    const { status } = deriveEntryStatus({
      triggered: true,
      applies: true,
      severity: "required",
      annotationStatus: "verified",
      catalogStatus: "flow_validating",
    });
    expect(status).toBe("required");
  });

  it("triggered + applies + informational → ready", () => {
    const { status, reason } = deriveEntryStatus({
      triggered: true,
      applies: true,
      severity: "informational",
      annotationStatus: "verified",
      catalogStatus: "verified",
    });
    expect(status).toBe("ready");
    expect(reason).toMatch(/informational/i);
  });

  it("triggered + applies + alternative → manual_review", () => {
    const { status, reason } = deriveEntryStatus({
      triggered: true,
      applies: true,
      severity: "alternative",
      annotationStatus: "verified",
      catalogStatus: "verified",
    });
    expect(status).toBe("manual_review");
    expect(reason).toMatch(/operator review/i);
  });

  it("triggered + applies + required → required", () => {
    const { status, reason } = deriveEntryStatus({
      triggered: true,
      applies: true,
      severity: "required",
      annotationStatus: "verified",
      catalogStatus: "verified",
    });
    expect(status).toBe("required");
    expect(reason).toMatch(/required/i);
  });

  it("manual_override annotation on a required row still routes to 'required'", () => {
    const { status } = deriveEntryStatus({
      triggered: true,
      applies: true,
      severity: "required",
      annotationStatus: "manual_override",
      catalogStatus: "verified",
    });
    expect(status).toBe("required");
  });
});

describe("groupEntriesByStatus", () => {
  it("returns all 4 buckets even when empty, in RGYG order", () => {
    const buckets = groupEntriesByStatus([]);
    expect(buckets.map((b) => b.status)).toEqual([
      "required",
      "tbd",
      "manual_review",
      "ready",
    ]);
    for (const b of buckets) expect(b.entries).toEqual([]);
  });

  it("routes entries into the correct bucket by status", () => {
    const buckets = groupEntriesByStatus([
      makeEntry({ catalog_code: "A1", status: "required" }),
      makeEntry({ catalog_code: "A2", status: "tbd" }),
      makeEntry({ catalog_code: "A3", status: "manual_review" }),
      makeEntry({ catalog_code: "A4", status: "ready" }),
      makeEntry({ catalog_code: "A5", status: "ready" }),
    ]);
    const [required, tbd, manualReview, ready] = buckets;
    expect(required.entries.map((e) => e.catalog_code)).toEqual(["A1"]);
    expect(tbd.entries.map((e) => e.catalog_code)).toEqual(["A2"]);
    expect(manualReview.entries.map((e) => e.catalog_code)).toEqual(["A3"]);
    expect(ready.entries.map((e) => e.catalog_code)).toEqual(["A4", "A5"]);
  });

  it("sorts within a bucket by agency_code then title", () => {
    const buckets = groupEntriesByStatus([
      makeEntry({ catalog_code: "A1", agency_code: "FDA", title: "Zeta", status: "required" }),
      makeEntry({ catalog_code: "A2", agency_code: "EPA", title: "Beta", status: "required" }),
      makeEntry({ catalog_code: "A3", agency_code: "EPA", title: "Alpha", status: "required" }),
    ]);
    expect(buckets[0].entries.map((e) => e.catalog_code)).toEqual([
      "A3", // EPA, Alpha
      "A2", // EPA, Beta
      "A1", // FDA, Zeta
    ]);
  });

  it("is stable when all entries land in one bucket (no cross-bucket bleed)", () => {
    const buckets = groupEntriesByStatus([
      makeEntry({ catalog_code: "A1", status: "ready" }),
      makeEntry({ catalog_code: "A2", status: "ready" }),
    ]);
    expect(buckets[0].entries).toEqual([]); // required
    expect(buckets[1].entries).toEqual([]); // tbd
    expect(buckets[2].entries).toEqual([]); // manual_review
    expect(buckets[3].entries).toHaveLength(2); // ready
  });
});
