/**
 * Stub engines — everything except tax. All return deterministic numbers
 * with `source: "stub_v1"` and `confidence: 0` so the envelope shape is
 * real while the numbers are openly fake. Every function here swaps for a
 * real engine later without touching the aggregator or the route.
 */

import type {
  FreightMode,
  FreightOption,
  ValuationBasis,
} from "./types";

// ---------------------------------------------------------------------------
// Duty
// ---------------------------------------------------------------------------

const FLAT_DUTY_RATE_PCT = 10;

export interface DutyEngineInput {
  hs_code: string;
  origin: string;
  destination: string;
  cif_value: number;
  fta_eligible: boolean;
  preferential_rate_pct: number | null;
}

export interface DutyEngineResult {
  value: number;
  rate_pct: number;
  basis: ValuationBasis;
  hs_code_used: string;
  fta_considered: boolean;
}

export function computeDuty(input: DutyEngineInput): DutyEngineResult {
  const rate = input.fta_eligible && input.preferential_rate_pct != null
    ? input.preferential_rate_pct
    : FLAT_DUTY_RATE_PCT;
  const value = round2((input.cif_value * rate) / 100);
  const hs6 = input.hs_code.replace(/\D/g, "").slice(0, 6);
  return {
    value,
    rate_pct: rate,
    basis: "CIF",
    hs_code_used: hs6,
    fta_considered: input.fta_eligible,
  };
}

// ---------------------------------------------------------------------------
// FTA
// ---------------------------------------------------------------------------

const USMCA_MEMBERS = new Set(["US", "CA", "MX"]);

export interface FtaEngineInput {
  hs_code: string;
  origin: string;
  destination: string;
}

export interface FtaEngineResult {
  eligible: boolean;
  agreement: string | null;
  preferential_rate_pct: number | null;
  required_documents: string[];
}

export function computeFta(input: FtaEngineInput): FtaEngineResult {
  const origin = input.origin.toUpperCase();
  const dest = input.destination.toUpperCase();
  if (USMCA_MEMBERS.has(origin) && USMCA_MEMBERS.has(dest) && origin !== dest) {
    return {
      eligible: true,
      agreement: "USMCA",
      preferential_rate_pct: 0,
      required_documents: ["USMCA_CoO"],
    };
  }
  return {
    eligible: false,
    agreement: null,
    preferential_rate_pct: null,
    required_documents: [],
  };
}

// ---------------------------------------------------------------------------
// De-minimis
// ---------------------------------------------------------------------------

const DE_MINIMIS_THRESHOLDS: Record<
  string,
  { value: number; currency: string; scope: "duty" | "duty_and_tax" }
> = {
  US: { value: 800, currency: "USD", scope: "duty_and_tax" },
  CA: { value: 20, currency: "CAD", scope: "duty_and_tax" },
  AU: { value: 1000, currency: "AUD", scope: "duty" },
  NZ: { value: 1000, currency: "NZD", scope: "duty" },
  GB: { value: 135, currency: "GBP", scope: "duty" },
  UK: { value: 135, currency: "GBP", scope: "duty" },
  // EU countries share the €150 threshold for duty; VAT via IOSS from €0.
  DE: { value: 150, currency: "EUR", scope: "duty" },
  FR: { value: 150, currency: "EUR", scope: "duty" },
  ES: { value: 150, currency: "EUR", scope: "duty" },
  IT: { value: 150, currency: "EUR", scope: "duty" },
  NL: { value: 150, currency: "EUR", scope: "duty" },
};

export interface DeMinimisEngineInput {
  destination: string;
  declared_value: number;
  declared_currency: string;
}

export interface DeMinimisEngineResult {
  applied: boolean;
  threshold: { value: number; currency: string } | null;
  scope: "duty" | "duty_and_tax" | null;
}

export function computeDeMinimis(
  input: DeMinimisEngineInput,
): DeMinimisEngineResult {
  const t = DE_MINIMIS_THRESHOLDS[input.destination.toUpperCase()];
  if (!t) return { applied: false, threshold: null, scope: null };
  // Currency-naive comparison for the scaffold. Real version converts first.
  const applied =
    input.declared_currency.toUpperCase() === t.currency &&
    input.declared_value < t.value;
  return {
    applied,
    threshold: { value: t.value, currency: t.currency },
    scope: t.scope,
  };
}

// ---------------------------------------------------------------------------
// Freight
// ---------------------------------------------------------------------------

const FREIGHT_BASE_USD = 12;
const FREIGHT_PER_KG_USD: Record<FreightMode, number> = {
  express: 18,
  standard: 9,
  economy: 5,
};
const FREIGHT_TRANSIT: Record<FreightMode, { min: number; max: number }> = {
  express: { min: 2, max: 4 },
  standard: { min: 5, max: 8 },
  economy: { min: 9, max: 16 },
};

export interface FreightEngineInput {
  origin: string;
  destination: string;
  weight_kg: number;
  mode?: FreightMode;
}

export function computeFreight(input: FreightEngineInput): FreightOption[] {
  const now = new Date().toISOString();
  const weight = Math.max(0.1, input.weight_kg);
  const modes: FreightMode[] = input.mode
    ? [input.mode]
    : ["express", "standard", "economy"];
  return modes.map((mode) => ({
    mode,
    value: round2(FREIGHT_BASE_USD + FREIGHT_PER_KG_USD[mode] * weight),
    currency: "USD",
    transit_days_estimate: FREIGHT_TRANSIT[mode],
    carrier_hint: "generic",
    source: "stub_v1",
    confidence: 0,
    derived_at: now,
  }));
}

// ---------------------------------------------------------------------------
// Insurance
// ---------------------------------------------------------------------------

export function computeInsurance(declaredValue: number): number {
  return round2(declaredValue * 0.01);
}

// ---------------------------------------------------------------------------
// Fees
// ---------------------------------------------------------------------------

export interface FeesEngineResult {
  total: number;
  breakdown: { code: string; value: number; currency: string }[];
}

export function computeFees(currency: string): FeesEngineResult {
  return {
    total: 2.5,
    breakdown: [{ code: "brokerage", value: 2.5, currency }],
  };
}

// ---------------------------------------------------------------------------
// FX — ECB-style daily reference + 2% buffer (static seed in v1)
// ---------------------------------------------------------------------------

const FX_BUFFER_PCT = 2;
const FX_STATIC_RATES_FROM_USD: Record<string, number> = {
  USD: 1,
  EUR: 0.923,
  GBP: 0.79,
  CAD: 1.36,
  AUD: 1.53,
  JPY: 148,
  MXN: 17.05,
  NZD: 1.65,
};

export interface FxResult {
  rate: number;
  source: string;
}

export function convertFx(from: string, to: string): FxResult {
  const f = FX_STATIC_RATES_FROM_USD[from.toUpperCase()];
  const t = FX_STATIC_RATES_FROM_USD[to.toUpperCase()];
  if (!f || !t) return { rate: 1, source: "fx_stub_unknown" };
  const base = t / f;
  const buffered = base * (1 + FX_BUFFER_PCT / 100);
  return { rate: round6(buffered), source: "fx_stub_ecb_plus_2pct" };
}

// ---------------------------------------------------------------------------

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function round6(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}
