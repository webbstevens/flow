/**
 * Landed Cost v1 envelope + request types (VISION.md §3.3).
 *
 * Every numeric field is wrapped `{ value, currency?, source, confidence,
 * derived_at }` per §4.3 (audit-grade). Slots that are nullable in v1
 * (payer, guarantee, destination_hs_codes, flow_service_fee) are present so
 * the shape doesn't change when v2/v3 fill them.
 */

export type TaxKind =
  | "VAT"
  | "GST"
  | "HST"
  | "PST"
  | "QST"
  | "SALES_TAX"
  | "LOCAL_TAX"
  | "IGST"
  | "CONSUMPTION"
  | "NONE";

export type ValuationBasis =
  | "CIF"
  | "CIF_PLUS_DUTY"
  | "FOB"
  | "TRANSACTION";

export type FreightMode = "express" | "standard" | "economy";

export type GuaranteeKind = "estimate" | "quoted";

export type Payer =
  | "flow_account"
  | "marketplace_account"
  | "buyer_on_delivery";

export type HsPrecision = "HS6" | "HS8" | "HS10";

export interface Money {
  amount: number;
  currency: string;
}

export interface AuditField<T = number> {
  value: T;
  currency?: string;
  source: string;
  confidence: number;
  derived_at: string;
}

export interface TaxLine {
  kind: TaxKind;
  jurisdiction: string; // "DE", "US-CA", "CA-QC"
  rate_pct: number;
  value: number;
  currency: string;
  basis: ValuationBasis;
  source: string;
}

export interface FreightOption {
  mode: FreightMode;
  value: number;
  currency: string;
  transit_days_estimate: { min: number; max: number };
  carrier_hint: string;
  source: string;
  confidence: number;
  derived_at: string;
}

export interface DestinationHsCode {
  country: string;
  code: string;
  precision: HsPrecision;
  source: string;
  confidence: number;
  warnings?: string[];
}

export interface LandedCostWarning {
  code: string;
  message: string;
  severity: "warning" | "info";
}

export interface LandedCostRequestProduct {
  hs_code: string;
  country_of_origin: string;
  declared_value: Money;
  weight_kg?: number;
  dimensions_cm?: { l: number; w: number; h: number };
}

export interface LandedCostRequestDestination {
  country: string;
  region?: string;
  postal_code?: string;
}

export interface LandedCostRequest {
  product: LandedCostRequestProduct;
  destinations: LandedCostRequestDestination[];
  origin?: { country: string };
  incoterm?: "DDP" | "DDU" | "DAP";
  freight_mode?: FreightMode;
  buyer_currency?: string;
  on_behalf_of?: string;
}

export interface LandedCostQuote {
  destination: LandedCostRequestDestination;

  product_value: AuditField;

  duty: AuditField & {
    rate_pct: number;
    basis: ValuationBasis;
    hs_code_used: string;
    fta_considered: boolean;
  };

  tax: {
    total: AuditField;
    breakdown: TaxLine[];
  };

  freight: FreightOption | null;
  freight_options: FreightOption[];

  insurance: AuditField;

  fees: AuditField & {
    breakdown: { code: string; value: number; currency: string }[];
  };

  landed_total: AuditField;
  buyer_total: AuditField & {
    fx_rate: number;
    fx_source: string;
  };

  valuation: {
    basis: ValuationBasis;
    value: Money;
    source: string;
  };

  de_minimis: {
    applied: boolean;
    threshold: { value: number; currency: string } | null;
    scope: "duty" | "duty_and_tax" | null;
    source: string;
  };

  fta: {
    eligible: boolean;
    agreement: string | null;
    preferential_rate_pct: number | null;
    required_documents: string[];
    source: string;
  };

  destination_hs_codes: DestinationHsCode[];

  payer: {
    duties_taxes: Payer;
    freight: Payer;
    carrier_account_ref: string | null;
  };

  guarantee: {
    kind: GuaranteeKind;
    flow_service_fee: AuditField | null;
    reconciliation_policy: "post_clearance" | null;
    confidence_band_pct: number;
  };

  warnings: LandedCostWarning[];
}

export interface LandedCostEnvelope {
  quote_id: string;
  issued_at: string;
  expires_at: string | null;
  ttl_policy: "advisory" | "enforced";
  quotes: LandedCostQuote[];
}
