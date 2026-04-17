import { describe, it, expect } from "vitest";
import {
  normalizeSeverity,
  deriveEntryStatus,
} from "@/lib/requirements-v2";

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
