/**
 * Aggregator — composes tax-engine (real) + stub engines into a single
 * LandedCostEnvelope per request. Handles per-destination fan-out and
 * assembles the envelope shape PR#1 ships.
 *
 * Order of composition (deliberate):
 *   FTA → duty → de-minimis → tax → freight → insurance → fees →
 *   landed_total → FX → buyer_total
 */

import { randomUUID } from "crypto";
import { auditField, round2 } from "./envelope";
import { computeTax } from "./tax-engine";
import {
  computeDuty,
  computeFta,
  computeDeMinimis,
  computeFreight,
  computeInsurance,
  computeFees,
  convertFx,
} from "./stub-engines";
import type {
  LandedCostRequest,
  LandedCostRequestDestination,
  LandedCostEnvelope,
  LandedCostQuote,
  LandedCostWarning,
  FreightOption,
} from "./types";

export async function buildLandedCostEnvelope(
  req: LandedCostRequest,
): Promise<LandedCostEnvelope> {
  const now = new Date().toISOString();
  const quotes = await Promise.all(
    req.destinations.map((dest) => buildQuote(req, dest, now)),
  );
  return {
    quote_id: `qte_${randomUUID().replace(/-/g, "")}`,
    issued_at: now,
    expires_at: null,
    ttl_policy: "advisory",
    quotes,
  };
}

async function buildQuote(
  req: LandedCostRequest,
  dest: LandedCostRequestDestination,
  now: string,
): Promise<LandedCostQuote> {
  const origin = (req.origin?.country ?? req.product.country_of_origin).toUpperCase();
  const destCountry = dest.country.toUpperCase();
  const currency = req.product.declared_value.currency;
  const declared = req.product.declared_value.amount;
  const weightKg = req.product.weight_kg ?? 0.5;
  const warnings: LandedCostWarning[] = [];

  // 1. FTA
  const fta = computeFta({
    hs_code: req.product.hs_code,
    origin,
    destination: destCountry,
  });

  // 2. De-minimis
  const deMinimis = computeDeMinimis({
    destination: destCountry,
    declared_value: declared,
    declared_currency: currency,
  });

  // 3. Freight (we need freight before duty for CIF basis)
  const freightOptions = computeFreight({
    origin,
    destination: destCountry,
    weight_kg: weightKg,
    mode: req.freight_mode,
  });
  const freightPrimary = selectPrimaryFreight(freightOptions, req.freight_mode);
  const freightValue = freightPrimary?.value ?? 0;

  // 4. Insurance
  const insuranceValue = computeInsurance(declared);

  // 5. Duty — suppressed by de-minimis with duty scope
  const dutySuppressed = deMinimis.applied;
  const cifValue = declared + freightValue + insuranceValue;
  const duty = dutySuppressed
    ? {
        value: 0,
        rate_pct: 0,
        basis: "CIF" as const,
        hs_code_used: req.product.hs_code.replace(/\D/g, "").slice(0, 6),
        fta_considered: fta.eligible,
      }
    : computeDuty({
        hs_code: req.product.hs_code,
        origin,
        destination: destCountry,
        cif_value: cifValue,
        fta_eligible: fta.eligible,
        preferential_rate_pct: fta.preferential_rate_pct,
      });

  // 6. Tax — suppressed when de-minimis covers duty_and_tax
  const taxSuppressed =
    deMinimis.applied && deMinimis.scope === "duty_and_tax";
  const tax = taxSuppressed
    ? { total: 0, breakdown: [], warnings: [] }
    : await computeTax({
        destination: { country: destCountry, region: dest.region },
        product_value: declared,
        freight_value: freightValue,
        insurance_value: insuranceValue,
        duty_value: duty.value,
        currency,
      });
  warnings.push(...tax.warnings);

  // 7. Fees
  const fees = computeFees(currency);

  // 8. Landed total (in declared currency)
  const landedTotal = round2(
    declared + duty.value + tax.total + freightValue + insuranceValue + fees.total,
  );

  // 9. Buyer total (FX convert)
  const buyerCurrency = (req.buyer_currency ?? currency).toUpperCase();
  const fx = convertFx(currency, buyerCurrency);
  const buyerTotal = round2(landedTotal * fx.rate);

  return {
    destination: dest,
    product_value: auditField(declared, "input", {
      currency,
      confidence: 1,
      derivedAt: now,
    }),
    duty: {
      ...auditField(duty.value, dutySuppressed ? "de_minimis_v1" : "duty_stub_v1", {
        currency,
        confidence: 0,
        derivedAt: now,
      }),
      rate_pct: duty.rate_pct,
      basis: duty.basis,
      hs_code_used: duty.hs_code_used,
      fta_considered: duty.fta_considered,
    },
    tax: {
      total: auditField(
        tax.total,
        taxSuppressed
          ? "de_minimis_v1"
          : tax.breakdown.length > 0
            ? "tax_engine_v1"
            : "tax_engine_v1_unsupported",
        { currency, confidence: tax.breakdown.length > 0 ? 0.6 : 0, derivedAt: now },
      ),
      breakdown: tax.breakdown,
    },
    freight: freightPrimary ?? null,
    freight_options: freightOptions,
    insurance: auditField(insuranceValue, "insurance_stub_v1", {
      currency,
      confidence: 0,
      derivedAt: now,
    }),
    fees: {
      ...auditField(fees.total, "fees_stub_v1", {
        currency,
        confidence: 0,
        derivedAt: now,
      }),
      breakdown: fees.breakdown,
    },
    landed_total: auditField(landedTotal, "aggregator_v1", {
      currency,
      confidence: 0,
      derivedAt: now,
    }),
    buyer_total: {
      ...auditField(buyerTotal, "aggregator_v1", {
        currency: buyerCurrency,
        confidence: 0,
        derivedAt: now,
      }),
      fx_rate: fx.rate,
      fx_source: fx.source,
    },
    valuation: {
      basis: "CIF",
      value: { amount: round2(cifValue), currency },
      source: "destination_rule_v1",
    },
    de_minimis: {
      applied: deMinimis.applied,
      threshold: deMinimis.threshold,
      scope: deMinimis.scope,
      source: "de_minimis_stub_v1",
    },
    fta: {
      eligible: fta.eligible,
      agreement: fta.agreement,
      preferential_rate_pct: fta.preferential_rate_pct,
      required_documents: fta.required_documents,
      source: "fta_stub_v1",
    },
    destination_hs_codes: [],
    payer: {
      duties_taxes: "marketplace_account",
      freight: "marketplace_account",
      carrier_account_ref: null,
    },
    guarantee: {
      kind: "estimate",
      flow_service_fee: null,
      reconciliation_policy: null,
      confidence_band_pct: 25,
    },
    warnings,
  };
}

function selectPrimaryFreight(
  options: FreightOption[],
  requested: string | undefined,
): FreightOption | null {
  if (options.length === 0) return null;
  if (requested) {
    return options.find((o) => o.mode === requested) ?? options[0];
  }
  // No mode specified → return cheapest as "primary" (product-page "starting from")
  return [...options].sort((a, b) => a.value - b.value)[0];
}
