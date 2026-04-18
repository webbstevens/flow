import { describe, it, expect, beforeEach, vi } from "vitest";

type TaxRateRow = {
  country: string;
  regionCode: string | null;
  localityCode: string | null;
  kind: string;
  ratePct: number;
  basis: string;
  source: string;
};

const taxRates: TaxRateRow[] = [];

vi.mock("@/lib/prisma", () => ({
  prisma: {
    taxRate: {
      findMany: vi.fn(
        async ({ where }: { where: Record<string, unknown> }) => {
          const country = where.country as string;
          const orClauses = where.OR as
            | { regionCode: string | null }[]
            | undefined;
          const regionEq = where.regionCode as string | null | undefined;
          return taxRates.filter((r) => {
            if (r.country !== country) return false;
            if (orClauses) {
              return orClauses.some((c) => c.regionCode === r.regionCode);
            }
            if (regionEq === null) return r.regionCode === null;
            return true;
          });
        },
      ),
    },
  },
}));

import { buildLandedCostEnvelope } from "@/lib/landed-cost/aggregator";
import { landedCostRequestSchema } from "@/lib/validation";
import type { LandedCostRequest } from "@/lib/landed-cost/types";

function seedRates() {
  taxRates.length = 0;
  taxRates.push(
    { country: "DE", regionCode: null, localityCode: null, kind: "VAT", ratePct: 19, basis: "CIF_PLUS_DUTY", source: "manual" },
    { country: "US", regionCode: "CA", localityCode: null, kind: "SALES_TAX", ratePct: 7.25, basis: "TRANSACTION", source: "manual" },
    { country: "US", regionCode: "OR", localityCode: null, kind: "NONE", ratePct: 0, basis: "TRANSACTION", source: "manual" },
    { country: "CA", regionCode: "QC", localityCode: null, kind: "GST", ratePct: 5, basis: "CIF_PLUS_DUTY", source: "manual" },
    { country: "CA", regionCode: "QC", localityCode: null, kind: "QST", ratePct: 9.975, basis: "CIF_PLUS_DUTY", source: "manual" },
    { country: "CA", regionCode: "ON", localityCode: null, kind: "HST", ratePct: 13, basis: "CIF_PLUS_DUTY", source: "manual" },
  );
}

const baseReq: LandedCostRequest = {
  product: {
    hs_code: "6109.10.0012",
    country_of_origin: "CN",
    declared_value: { amount: 24, currency: "USD" },
    weight_kg: 0.2,
  },
  destinations: [{ country: "DE" }],
  origin: { country: "CN" },
};

describe("landed-cost request schema", () => {
  it("accepts a minimal valid request", () => {
    const parsed = landedCostRequestSchema.safeParse(baseReq);
    expect(parsed.success).toBe(true);
  });

  it("rejects empty destinations", () => {
    const parsed = landedCostRequestSchema.safeParse({
      ...baseReq,
      destinations: [],
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects non-ISO-2 country codes", () => {
    const parsed = landedCostRequestSchema.safeParse({
      ...baseReq,
      destinations: [{ country: "Germany" }],
    });
    expect(parsed.success).toBe(false);
  });

  it("uppercases country codes", () => {
    const parsed = landedCostRequestSchema.safeParse({
      ...baseReq,
      destinations: [{ country: "de" }],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.destinations[0].country).toBe("DE");
    }
  });
});

describe("buildLandedCostEnvelope — envelope shape", () => {
  beforeEach(seedRates);

  it("produces a full envelope for a single destination", async () => {
    const env = await buildLandedCostEnvelope(baseReq);
    expect(env.quote_id).toMatch(/^qte_[a-f0-9]+$/);
    expect(env.ttl_policy).toBe("advisory");
    expect(env.expires_at).toBeNull();
    expect(env.quotes).toHaveLength(1);

    const q = env.quotes[0];
    expect(q.destination.country).toBe("DE");
    expect(q.valuation.basis).toBe("CIF");
    expect(q.payer.duties_taxes).toBe("marketplace_account");
    expect(q.guarantee.kind).toBe("estimate");
    expect(q.guarantee.flow_service_fee).toBeNull();
    expect(q.destination_hs_codes).toEqual([]);
  });

  it("wraps every numeric field with source + confidence + derived_at", async () => {
    const env = await buildLandedCostEnvelope(baseReq);
    const q = env.quotes[0];
    for (const field of [
      q.product_value,
      q.duty,
      q.tax.total,
      q.insurance,
      q.fees,
      q.landed_total,
      q.buyer_total,
    ]) {
      expect(typeof field.source).toBe("string");
      expect(typeof field.confidence).toBe("number");
      expect(field.derived_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    }
  });

  it("returns cheapest freight_options as primary when no mode given", async () => {
    const env = await buildLandedCostEnvelope(baseReq);
    const q = env.quotes[0];
    expect(q.freight_options).toHaveLength(3);
    expect(q.freight?.mode).toBe("economy");
  });

  it("returns the requested freight mode when specified", async () => {
    const env = await buildLandedCostEnvelope({
      ...baseReq,
      freight_mode: "express",
    });
    const q = env.quotes[0];
    expect(q.freight_options).toHaveLength(1);
    expect(q.freight?.mode).toBe("express");
  });
});

describe("buildLandedCostEnvelope — tax regimes", () => {
  beforeEach(seedRates);

  it("EU destination → single VAT line on CIF+duty basis", async () => {
    const env = await buildLandedCostEnvelope(baseReq);
    const t = env.quotes[0].tax;
    expect(t.breakdown).toHaveLength(1);
    expect(t.breakdown[0].kind).toBe("VAT");
    expect(t.breakdown[0].jurisdiction).toBe("DE");
    expect(t.breakdown[0].basis).toBe("CIF_PLUS_DUTY");
    expect(t.total.value).toBeGreaterThan(0);
  });

  it("US-CA → single SALES_TAX line on transaction basis", async () => {
    const env = await buildLandedCostEnvelope({
      ...baseReq,
      product: { ...baseReq.product, declared_value: { amount: 900, currency: "USD" } },
      destinations: [{ country: "US", region: "CA" }],
    });
    const t = env.quotes[0].tax;
    expect(t.breakdown).toHaveLength(1);
    expect(t.breakdown[0].kind).toBe("SALES_TAX");
    expect(t.breakdown[0].jurisdiction).toBe("US-CA");
    expect(t.breakdown[0].basis).toBe("TRANSACTION");
  });

  it("CA-QC → two lines (GST + QST)", async () => {
    const env = await buildLandedCostEnvelope({
      ...baseReq,
      destinations: [{ country: "CA", region: "QC" }],
    });
    const t = env.quotes[0].tax;
    expect(t.breakdown).toHaveLength(2);
    const kinds = t.breakdown.map((l) => l.kind).sort();
    expect(kinds).toEqual(["GST", "QST"]);
  });

  it("CA-ON → single HST line", async () => {
    const env = await buildLandedCostEnvelope({
      ...baseReq,
      destinations: [{ country: "CA", region: "ON" }],
    });
    const t = env.quotes[0].tax;
    expect(t.breakdown).toHaveLength(1);
    expect(t.breakdown[0].kind).toBe("HST");
  });

  it("US without region → quote + warning (not a hard error)", async () => {
    const env = await buildLandedCostEnvelope({
      ...baseReq,
      product: { ...baseReq.product, declared_value: { amount: 900, currency: "USD" } },
      destinations: [{ country: "US" }],
    });
    const q = env.quotes[0];
    expect(q.warnings.some((w) => w.code === "destination_region_required_for_accurate_tax")).toBe(true);
  });

  it("US-OR (no sales tax) → NONE row produces empty breakdown, no unsupported warning", async () => {
    const env = await buildLandedCostEnvelope({
      ...baseReq,
      destinations: [{ country: "US", region: "OR" }],
    });
    const q = env.quotes[0];
    expect(q.tax.breakdown).toEqual([]);
    expect(q.warnings.find((w) => w.code === "unsupported_tax_regime")).toBeUndefined();
  });

  it("BR (unseeded) → unsupported_tax_regime warning + zero-tax quote", async () => {
    const env = await buildLandedCostEnvelope({
      ...baseReq,
      destinations: [{ country: "BR", region: "SP" }],
    });
    const q = env.quotes[0];
    expect(q.tax.total.value).toBe(0);
    expect(q.tax.breakdown).toEqual([]);
    expect(q.warnings.some((w) => w.code === "unsupported_tax_regime")).toBe(true);
  });
});

describe("buildLandedCostEnvelope — duty + FTA + de-minimis", () => {
  beforeEach(seedRates);

  it("applies flat stub duty of 10% on CIF", async () => {
    const env = await buildLandedCostEnvelope(baseReq);
    const q = env.quotes[0];
    expect(q.duty.rate_pct).toBe(10);
    expect(q.duty.basis).toBe("CIF");
    expect(q.duty.value).toBeGreaterThan(0);
  });

  it("USMCA lane (MX→US) → FTA eligible, preferential 0% duty", async () => {
    const env = await buildLandedCostEnvelope({
      ...baseReq,
      product: { ...baseReq.product, country_of_origin: "MX" },
      origin: { country: "MX" },
      destinations: [{ country: "US", region: "TX" }],
    });
    const q = env.quotes[0];
    expect(q.fta.eligible).toBe(true);
    expect(q.fta.agreement).toBe("USMCA");
    expect(q.duty.value).toBe(0);
    expect(q.duty.rate_pct).toBe(0);
  });

  it("US de-minimis ($800) suppresses duty + tax on low-value shipment", async () => {
    const env = await buildLandedCostEnvelope({
      ...baseReq,
      product: { ...baseReq.product, declared_value: { amount: 50, currency: "USD" } },
      destinations: [{ country: "US", region: "CA" }],
    });
    const q = env.quotes[0];
    expect(q.de_minimis.applied).toBe(true);
    expect(q.duty.value).toBe(0);
    expect(q.tax.total.value).toBe(0);
  });
});

describe("buildLandedCostEnvelope — bulk", () => {
  beforeEach(seedRates);

  it("handles multiple destinations in one envelope", async () => {
    const env = await buildLandedCostEnvelope({
      ...baseReq,
      destinations: [
        { country: "DE" },
        { country: "US", region: "CA" },
        { country: "CA", region: "QC" },
        { country: "BR", region: "SP" },
      ],
    });
    expect(env.quotes).toHaveLength(4);
    const brQuote = env.quotes.find((q) => q.destination.country === "BR")!;
    expect(brQuote.warnings.some((w) => w.code === "unsupported_tax_regime")).toBe(true);
  });
});
