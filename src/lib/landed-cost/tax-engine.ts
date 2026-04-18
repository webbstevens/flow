/**
 * Tax engine — the one engine that's real in v1.
 *
 * Resolution order per destination:
 *   1. Country + region → region-scoped rows (US state, CA province)
 *   2. Country only → country rows (VAT/GST/IGST single-rate)
 *   3. Empty result → unsupported-regime warning; caller emits NONE line
 *
 * Basis:
 *   CIF            = product + freight + insurance
 *   CIF_PLUS_DUTY  = CIF + duty (most EU destinations)
 *   FOB            = product only
 *   TRANSACTION    = declared product value
 */

import { prisma } from "@/lib/prisma";
import type { TaxLine, TaxKind, ValuationBasis } from "./types";

const REGION_REQUIRED_COUNTRIES = new Set(["US", "CA", "BR"]);

export interface TaxEngineInput {
  destination: { country: string; region?: string };
  product_value: number;
  freight_value: number;
  insurance_value: number;
  duty_value: number;
  currency: string;
}

export interface TaxEngineResult {
  total: number;
  breakdown: TaxLine[];
  warnings: { code: string; message: string; severity: "warning" | "info" }[];
}

export async function computeTax(input: TaxEngineInput): Promise<TaxEngineResult> {
  const country = input.destination.country.toUpperCase();
  const region = input.destination.region?.toUpperCase();

  const rows = await prisma.taxRate.findMany({
    where: {
      country,
      ...(region
        ? { OR: [{ regionCode: region }, { regionCode: null }] }
        : { regionCode: null }),
    },
  });

  const warnings: TaxEngineResult["warnings"] = [];
  const needsRegion = REGION_REQUIRED_COUNTRIES.has(country) && !region;
  if (needsRegion) {
    warnings.push({
      code: "destination_region_required_for_accurate_tax",
      message: `${country} destinations require a region code for accurate tax; quote is an approximation.`,
      severity: "warning",
    });
  }

  if (rows.length === 0) {
    warnings.push({
      code: "unsupported_tax_regime",
      message: `No tax rules seeded for ${country}${region ? `-${region}` : ""}; tax line omitted.`,
      severity: "warning",
    });
    return { total: 0, breakdown: [], warnings };
  }

  let total = 0;
  const breakdown: TaxLine[] = [];
  for (const row of rows) {
    if (row.kind === "NONE") continue;
    const basis = row.basis as ValuationBasis;
    const base = taxBase(basis, input);
    const rate = Number(row.ratePct);
    const value = round2((base * rate) / 100);
    total += value;
    breakdown.push({
      kind: row.kind as TaxKind,
      jurisdiction: row.regionCode
        ? `${row.country}-${row.regionCode}`
        : row.country,
      rate_pct: rate,
      value,
      currency: input.currency,
      basis,
      source: row.source,
    });
  }

  return { total: round2(total), breakdown, warnings };
}

function taxBase(basis: ValuationBasis, i: TaxEngineInput): number {
  switch (basis) {
    case "CIF":
      return i.product_value + i.freight_value + i.insurance_value;
    case "CIF_PLUS_DUTY":
      return i.product_value + i.freight_value + i.insurance_value + i.duty_value;
    case "FOB":
      return i.product_value;
    case "TRANSACTION":
      return i.product_value;
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
