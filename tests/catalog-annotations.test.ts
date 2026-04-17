import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isRequirementsV2Enabled } from "@/lib/catalog-annotations";

describe("isRequirementsV2Enabled — PR 4 flag flip", () => {
  const original = process.env.REQUIREMENTS_V2;

  beforeEach(() => {
    delete process.env.REQUIREMENTS_V2;
  });

  afterEach(() => {
    if (original === undefined) delete process.env.REQUIREMENTS_V2;
    else process.env.REQUIREMENTS_V2 = original;
  });

  it("defaults to enabled when the env var is unset", () => {
    expect(isRequirementsV2Enabled()).toBe(true);
  });

  it("is enabled when set to 'true'", () => {
    process.env.REQUIREMENTS_V2 = "true";
    expect(isRequirementsV2Enabled()).toBe(true);
  });

  it("is enabled for unrelated values (only literal 'false' disables)", () => {
    process.env.REQUIREMENTS_V2 = "1";
    expect(isRequirementsV2Enabled()).toBe(true);
  });

  it("is disabled only when explicitly set to 'false'", () => {
    process.env.REQUIREMENTS_V2 = "false";
    expect(isRequirementsV2Enabled()).toBe(false);
  });
});
