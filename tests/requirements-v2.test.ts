import { describe, it, expect } from "vitest";
import {
  normalizeSeverity,
  deriveEntryStatus,
  groupEntriesByAgency,
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

describe("groupEntriesByAgency", () => {
  it("returns [] for no entries", () => {
    expect(groupEntriesByAgency([])).toEqual([]);
  });

  it("collapses multiple entries under the same agency_code", () => {
    const groups = groupEntriesByAgency([
      makeEntry({ catalog_code: "A1", agency_code: "FDA", status: "ready" }),
      makeEntry({ catalog_code: "A2", agency_code: "FDA", status: "ready" }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].entries).toHaveLength(2);
  });

  it("computes worst-case status using the rank order", () => {
    const groups = groupEntriesByAgency([
      makeEntry({ catalog_code: "A1", agency_code: "FDA", status: "ready" }),
      makeEntry({ catalog_code: "A2", agency_code: "FDA", status: "tbd" }),
      makeEntry({ catalog_code: "A3", agency_code: "FDA", status: "manual_review" }),
    ]);
    expect(groups[0].worst).toBe("manual_review");
  });

  it("computes actionCount = required + manual_review + tbd (excludes ready)", () => {
    const groups = groupEntriesByAgency([
      makeEntry({ catalog_code: "A1", agency_code: "FDA", status: "required" }),
      makeEntry({ catalog_code: "A2", agency_code: "FDA", status: "tbd" }),
      makeEntry({ catalog_code: "A3", agency_code: "FDA", status: "ready" }),
    ]);
    expect(groups[0].actionCount).toBe(2);
    expect(groups[0].counts).toEqual({
      required: 1,
      tbd: 1,
      ready: 1,
      manual_review: 0,
    });
  });

  it("sorts by worst status first (required before manual_review before tbd before ready)", () => {
    const groups = groupEntriesByAgency([
      makeEntry({ catalog_code: "A1", agency_code: "FDA", agency_name: "FDA", status: "ready" }),
      makeEntry({ catalog_code: "A2", agency_code: "EPA", agency_name: "EPA", status: "required" }),
      makeEntry({ catalog_code: "A3", agency_code: "CPSC", agency_name: "CPSC", status: "manual_review" }),
    ]);
    expect(groups.map((g) => g.code)).toEqual(["EPA", "CPSC", "FDA"]);
  });

  it("within the same worst-status tier, sorts by actionCount desc, then name", () => {
    const groups = groupEntriesByAgency([
      makeEntry({ catalog_code: "A1", agency_code: "FDA", agency_name: "FDA", status: "required" }),
      makeEntry({ catalog_code: "A2", agency_code: "EPA", agency_name: "EPA", status: "required" }),
      makeEntry({ catalog_code: "A3", agency_code: "EPA", agency_name: "EPA", status: "required" }),
    ]);
    expect(groups[0].code).toBe("EPA");
    expect(groups[1].code).toBe("FDA");
  });
});
