/**
 * Cross-border certificate / document catalog.
 *
 * Hand-authored static reference data. Covers the US / UK / EU corridors only
 * for v1 (see compliance roadmap). Promoted to a DB table later when we need
 * SQL queryability — for now a typed TS constant keeps the feature schema-free.
 *
 * Code prefixes follow EU TARIC conventions:
 *   - C : Certificate
 *   - L : Import licence
 *   - U : Origin declaration
 *   - X : Export licence / authorisation
 *   - N : Other document
 *   - Y : Negative declaration (statement code) — "this good is NOT subject to …"
 * US-specific PGA flags are prefixed with the agency code (FDA_, EPA_, …).
 */

export type CertificateJurisdiction = "US" | "EU" | "UK" | "INTL";

export type CertificateTypeCode =
  | "C" // Certificate
  | "L" // Import licence
  | "U" // Origin declaration
  | "X" // Export licence
  | "N" // Other document
  | "Y" // Negative declaration
  | "PGA"; // US Participating Government Agency flag

export interface CertificateEntry {
  code: string;
  type: CertificateTypeCode;
  name: string;
  agency: string; // e.g. "CITES_MA", "FDA", "DG_TAXUD"
  jurisdiction: CertificateJurisdiction;
  description: string;
}

/** Agency display names — kept here so the UI can render a friendly label. */
export const AGENCY_NAMES: Record<string, string> = {
  CITES_MA: "CITES Management Authority",
  DG_TAXUD: "EU DG TAXUD",
  DG_ENV: "EU DG Environment",
  DG_TRADE: "EU DG Trade",
  HMRC: "HM Revenue & Customs",
  FDA: "US FDA",
  EPA: "US EPA",
  FWS: "US Fish & Wildlife Service",
  USDA_APHIS: "USDA APHIS",
  CPSC: "US Consumer Product Safety Commission",
  DOT: "US Department of Transportation",
  BIS: "US Bureau of Industry & Security",
  CBP: "US Customs & Border Protection",
  NONE: "Commercial",
};

export const CERTIFICATE_CATALOG = {
  // -----------------------------------------------------------------------
  // EU Y-codes (negative declarations) — from the LITE screenshot
  // -----------------------------------------------------------------------
  Y900: {
    code: "Y900",
    type: "Y",
    name: "Not subject to CITES (general)",
    agency: "DG_ENV",
    jurisdiction: "EU",
    description:
      "Declaration that the goods are not listed under the CITES Convention.",
  },
  Y901: {
    code: "Y901",
    type: "Y",
    name: "Not subject to dual-use controls",
    agency: "DG_TRADE",
    jurisdiction: "EU",
    description:
      "Declaration that the goods are not dual-use items under EU Reg 2021/821.",
  },
  Y902: {
    code: "Y902",
    type: "Y",
    name: "Not ozone-depleting substances",
    agency: "DG_ENV",
    jurisdiction: "EU",
    description:
      "Declaration that the goods do not contain ozone-depleting substances under the Montreal Protocol.",
  },
  Y903: {
    code: "Y903",
    type: "Y",
    name: "Not cultural goods",
    agency: "DG_TAXUD",
    jurisdiction: "EU",
    description:
      "Declaration that the goods are not cultural goods requiring an export licence under Reg 116/2009.",
  },
  Y908: {
    code: "Y908",
    type: "Y",
    name: "Not subject to CITES permit",
    agency: "CITES_MA",
    jurisdiction: "EU",
    description:
      "Declaration that the specific goods are exempt from CITES permit requirements.",
  },
  Y916: {
    code: "Y916",
    type: "Y",
    name: "Not subject to PIC regulation",
    agency: "DG_ENV",
    jurisdiction: "EU",
    description:
      "Declaration that the goods are not hazardous chemicals under Prior Informed Consent (Reg 649/2012).",
  },
  Y922: {
    code: "Y922",
    type: "Y",
    name: "No cat or dog fur",
    agency: "DG_TAXUD",
    jurisdiction: "EU",
    description:
      "Declaration that the goods do not contain cat or dog fur (Reg 1523/2007).",
  },
  Y923: {
    code: "Y923",
    type: "Y",
    name: "Not seal product",
    agency: "DG_ENV",
    jurisdiction: "EU",
    description:
      "Declaration that the goods do not contain seal products (Reg 1007/2009).",
  },
  Y928: {
    code: "Y928",
    type: "Y",
    name: "Not subject to restricted-country measures",
    agency: "DG_TRADE",
    jurisdiction: "EU",
    description:
      "Declaration that the goods are not subject to embargoes / sanctions on their country of origin.",
  },
  Y984: {
    code: "Y984",
    type: "Y",
    name: "Not subject to Ukraine restrictive measures",
    agency: "DG_TRADE",
    jurisdiction: "EU",
    description:
      "Declaration that the goods are not covered by EU restrictive measures on Ukraine-related transactions.",
  },
  Y999: {
    code: "Y999",
    type: "Y",
    name: "Not subject to Russia restrictive measures",
    agency: "DG_TRADE",
    jurisdiction: "EU",
    description:
      "Declaration that the goods are not covered by EU sanctions on Russia (Reg 833/2014).",
  },

  // -----------------------------------------------------------------------
  // EU positive documents
  // -----------------------------------------------------------------------
  C400: {
    code: "C400",
    type: "C",
    name: "CITES import permit",
    agency: "CITES_MA",
    jurisdiction: "EU",
    description:
      "Import permit for species listed in CITES Appendices I/II/III.",
  },
  C644: {
    code: "C644",
    type: "C",
    name: "Cultural goods export licence",
    agency: "DG_TAXUD",
    jurisdiction: "EU",
    description:
      "Export licence required for cultural goods leaving EU customs territory.",
  },
  C729: {
    code: "C729",
    type: "C",
    name: "Ozone-depleting substances licence",
    agency: "DG_ENV",
    jurisdiction: "EU",
    description:
      "Authorisation for import/export of ozone-depleting substances.",
  },
  U045: {
    code: "U045",
    type: "U",
    name: "REX origin declaration",
    agency: "DG_TAXUD",
    jurisdiction: "EU",
    description:
      "Registered Exporter origin declaration for preferential tariff treatment (GSP, EU FTAs).",
  },
  U048: {
    code: "U048",
    type: "U",
    name: "EUR.1 movement certificate",
    agency: "DG_TAXUD",
    jurisdiction: "EU",
    description:
      "Proof of preferential origin under EU free trade agreements.",
  },
  X002: {
    code: "X002",
    type: "X",
    name: "Dual-use export authorisation",
    agency: "DG_TRADE",
    jurisdiction: "EU",
    description:
      "Export authorisation for dual-use items under Reg 2021/821.",
  },

  // -----------------------------------------------------------------------
  // UK (post-Brexit CDS — mostly mirrors TARIC; additions where they differ)
  // -----------------------------------------------------------------------
  UK_REX: {
    code: "UK_REX",
    type: "U",
    name: "UK REX origin declaration",
    agency: "HMRC",
    jurisdiction: "UK",
    description:
      "UK Registered Exporter origin declaration for preferential access under UK FTAs (e.g. CPTPP, UK-EU TCA).",
  },
  UK_EUR1: {
    code: "UK_EUR1",
    type: "U",
    name: "UK EUR.1 movement certificate",
    agency: "HMRC",
    jurisdiction: "UK",
    description:
      "Proof of preferential origin under UK continuity agreements.",
  },

  // -----------------------------------------------------------------------
  // US PGA flags & common documents
  // -----------------------------------------------------------------------
  FDA_PN: {
    code: "FDA_PN",
    type: "PGA",
    name: "FDA Prior Notice",
    agency: "FDA",
    jurisdiction: "US",
    description:
      "Advance notice of imported food shipments under the Bioterrorism Act.",
  },
  FDA_FCE: {
    code: "FDA_FCE",
    type: "PGA",
    name: "FDA Food Canning Establishment registration",
    agency: "FDA",
    jurisdiction: "US",
    description:
      "Required for acidified / low-acid canned foods imported into the US.",
  },
  FDA_DEVICE: {
    code: "FDA_DEVICE",
    type: "PGA",
    name: "FDA medical device listing",
    agency: "FDA",
    jurisdiction: "US",
    description:
      "Establishment registration and device listing for FDA-regulated devices.",
  },
  FWS_3177: {
    code: "FWS_3177",
    type: "PGA",
    name: "FWS Form 3-177",
    agency: "FWS",
    jurisdiction: "US",
    description:
      "Declaration for Importation/Exportation of Fish or Wildlife.",
  },
  EPA_TSCA: {
    code: "EPA_TSCA",
    type: "PGA",
    name: "EPA TSCA Section 13 certification",
    agency: "EPA",
    jurisdiction: "US",
    description:
      "Positive or negative TSCA certification required for chemicals and articles containing chemicals.",
  },
  EPA_HS7: {
    code: "EPA_HS7",
    type: "PGA",
    name: "EPA Form 3520-1",
    agency: "EPA",
    jurisdiction: "US",
    description:
      "Declaration for imported motor vehicles and engines under the Clean Air Act.",
  },
  USDA_PPQ: {
    code: "USDA_PPQ",
    type: "PGA",
    name: "USDA APHIS PPQ permit",
    agency: "USDA_APHIS",
    jurisdiction: "US",
    description:
      "Plant Protection & Quarantine permit for plants, seeds, and plant products.",
  },
  CPSC_GCC: {
    code: "CPSC_GCC",
    type: "PGA",
    name: "CPSC General Certificate of Conformity",
    agency: "CPSC",
    jurisdiction: "US",
    description:
      "Required for non-children's products subject to a CPSC-enforced rule.",
  },
  CPSC_CPC: {
    code: "CPSC_CPC",
    type: "PGA",
    name: "CPSC Children's Product Certificate",
    agency: "CPSC",
    jurisdiction: "US",
    description:
      "Third-party-tested certificate for consumer products intended for children ≤12.",
  },
  DOT_HS7: {
    code: "DOT_HS7",
    type: "PGA",
    name: "DOT Form HS-7",
    agency: "DOT",
    jurisdiction: "US",
    description:
      "Declaration for motor vehicle equipment subject to FMVSS.",
  },
  BIS_SCL: {
    code: "BIS_SCL",
    type: "PGA",
    name: "BIS export license",
    agency: "BIS",
    jurisdiction: "US",
    description:
      "US dual-use export license under the EAR (ECCN-driven).",
  },
  USMCA_COO: {
    code: "USMCA_COO",
    type: "U",
    name: "USMCA Certification of Origin",
    agency: "CBP",
    jurisdiction: "US",
    description:
      "Importer/exporter/producer certification of USMCA preferential origin.",
  },

  // -----------------------------------------------------------------------
  // Universal commercial documents
  // -----------------------------------------------------------------------
  COMMERCIAL_INVOICE: {
    code: "COMMERCIAL_INVOICE",
    type: "N",
    name: "Commercial invoice",
    agency: "NONE",
    jurisdiction: "INTL",
    description:
      "Seller-issued invoice used as the basis for customs valuation.",
  },
  PACKING_LIST: {
    code: "PACKING_LIST",
    type: "N",
    name: "Packing list",
    agency: "NONE",
    jurisdiction: "INTL",
    description:
      "Itemised list of contents, weights, and dimensions per package.",
  },
  BILL_OF_LADING: {
    code: "BILL_OF_LADING",
    type: "N",
    name: "Bill of lading",
    agency: "NONE",
    jurisdiction: "INTL",
    description:
      "Ocean carrier-issued transport document and title to the goods.",
  },
  AIRWAY_BILL: {
    code: "AIRWAY_BILL",
    type: "N",
    name: "Airway bill",
    agency: "NONE",
    jurisdiction: "INTL",
    description:
      "Air carrier-issued transport document acknowledging receipt of cargo. Non-negotiable; does not convey title.",
  },
  PROFORMA_INVOICE: {
    code: "PROFORMA_INVOICE",
    type: "N",
    name: "Proforma invoice",
    agency: "NONE",
    jurisdiction: "INTL",
    description:
      "Preliminary invoice issued before shipment, used for customs pre-clearance, letters of credit, and import licences where a commercial invoice is not yet available.",
  },
} as const satisfies Record<string, CertificateEntry>;

export type CertificateCode = keyof typeof CERTIFICATE_CATALOG;

export function isCertificateCode(code: string): code is CertificateCode {
  return code in CERTIFICATE_CATALOG;
}

export function getCertificate(code: string): CertificateEntry | null {
  return isCertificateCode(code) ? CERTIFICATE_CATALOG[code] : null;
}

/** Codes grouped by destination jurisdiction — used to narrow the LLM prompt. */
export function catalogForJurisdiction(
  jurisdiction: CertificateJurisdiction,
): CertificateEntry[] {
  return Object.values(CERTIFICATE_CATALOG).filter(
    (c) => c.jurisdiction === jurisdiction || c.jurisdiction === "INTL",
  );
}

/**
 * Map an ISO2 destination country to the jurisdiction that governs its import
 * regime. EU member states collapse to "EU".
 */
const EU_MEMBERS = new Set([
  "AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "ES", "FI",
  "FR", "GR", "HR", "HU", "IE", "IT", "LT", "LU", "LV", "MT",
  "NL", "PL", "PT", "RO", "SE", "SI", "SK",
]);

export function jurisdictionForCountry(
  iso2: string,
): "US" | "UK" | "EU" | null {
  if (iso2 === "US") return "US";
  if (iso2 === "GB") return "UK";
  if (EU_MEMBERS.has(iso2)) return "EU";
  return null;
}
