import { describe, it, expect } from "vitest";
import { hs6 } from "@/lib/requirements";
import { jurisdictionForCountry } from "@/lib/certificate-catalog";

describe("hs6", () => {
  it("strips dots and returns the first 6 digits", () => {
    expect(hs6("6109.10.0012")).toBe("610910");
  });

  it("pads short codes with trailing zeros to 6 digits", () => {
    expect(hs6("6109")).toBe("610900");
  });

  it("handles a 6-digit code as-is", () => {
    expect(hs6("610910")).toBe("610910");
  });

  it("strips any non-digit characters", () => {
    expect(hs6("hts-6109/10.0012")).toBe("610910");
  });

  it("pads an empty string to 6 zeros (not useful but stable)", () => {
    expect(hs6("")).toBe("000000");
  });
});

describe("jurisdictionForCountry", () => {
  it("returns 'US' for US", () => {
    expect(jurisdictionForCountry("US")).toBe("US");
  });

  it("returns 'UK' for GB (not 'UK' — ISO2 is GB)", () => {
    expect(jurisdictionForCountry("GB")).toBe("UK");
  });

  it("returns 'EU' for a member state (DE)", () => {
    expect(jurisdictionForCountry("DE")).toBe("EU");
  });

  it("returns 'EU' for another member state (FR)", () => {
    expect(jurisdictionForCountry("FR")).toBe("EU");
  });

  it("returns null for a non-covered destination (CN)", () => {
    expect(jurisdictionForCountry("CN")).toBeNull();
  });

  it("returns null for a lowercase/unnormalized input (caller normalizes)", () => {
    expect(jurisdictionForCountry("us")).toBeNull();
  });
});
