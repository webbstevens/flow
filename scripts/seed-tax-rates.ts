/**
 * Seed `tax_rates` for Landed Cost v1 (VISION.md §3.3).
 *
 * Scope (locked in planning):
 *   - EU VAT (27 countries, standard rate, CIF+duty basis)
 *   - UK VAT
 *   - AU GST, NZ GST, JP consumption, CH VAT, SG GST, MX IVA, KR VAT,
 *     IN IGST flat, CN VAT, and a long-tail of single-rate countries
 *   - US state sales tax (~45 states that levy sales tax; NoMad states
 *     seeded as NONE)
 *   - CA provincial combined rate (13 provinces/territories)
 *   - BR intentionally omitted — unsupported_tax_regime warning
 *
 * All rows land as source='manual', status='verified' since these are
 * hand-curated standard rates from public sources.
 *
 * Run:
 *   npx tsx --env-file=.env scripts/seed-tax-rates.ts
 *
 * Idempotent (upsert on the composite unique key).
 */

import { prisma } from "../src/lib/prisma";

type Seed = {
  country: string;
  regionCode: string | null;
  localityCode: string | null;
  kind: string;
  ratePct: number;
  basis: string;
};

const EU_VAT: Seed[] = [
  ["AT", 20], ["BE", 21], ["BG", 20], ["HR", 25], ["CY", 19],
  ["CZ", 21], ["DK", 25], ["EE", 22], ["FI", 24], ["FR", 20],
  ["DE", 19], ["GR", 24], ["HU", 27], ["IE", 23], ["IT", 22],
  ["LV", 21], ["LT", 21], ["LU", 17], ["MT", 18], ["NL", 21],
  ["PL", 23], ["PT", 23], ["RO", 19], ["SK", 20], ["SI", 22],
  ["ES", 21], ["SE", 25],
].map(([country, rate]) => ({
  country: String(country),
  regionCode: null,
  localityCode: null,
  kind: "VAT",
  ratePct: Number(rate),
  basis: "CIF_PLUS_DUTY",
}));

const REST_OF_WORLD: Seed[] = [
  { country: "GB", kind: "VAT", ratePct: 20, basis: "CIF_PLUS_DUTY" },
  { country: "CH", kind: "VAT", ratePct: 8.1, basis: "CIF_PLUS_DUTY" },
  { country: "NO", kind: "VAT", ratePct: 25, basis: "CIF_PLUS_DUTY" },
  { country: "AU", kind: "GST", ratePct: 10, basis: "CIF_PLUS_DUTY" },
  { country: "NZ", kind: "GST", ratePct: 15, basis: "CIF_PLUS_DUTY" },
  { country: "JP", kind: "CONSUMPTION", ratePct: 10, basis: "CIF_PLUS_DUTY" },
  { country: "KR", kind: "VAT", ratePct: 10, basis: "CIF_PLUS_DUTY" },
  { country: "SG", kind: "GST", ratePct: 9, basis: "CIF_PLUS_DUTY" },
  { country: "MY", kind: "GST", ratePct: 8, basis: "CIF_PLUS_DUTY" },
  { country: "CN", kind: "VAT", ratePct: 13, basis: "CIF_PLUS_DUTY" },
  { country: "HK", kind: "NONE", ratePct: 0, basis: "CIF" },
  { country: "MX", kind: "VAT", ratePct: 16, basis: "CIF_PLUS_DUTY" },
  { country: "AR", kind: "VAT", ratePct: 21, basis: "CIF_PLUS_DUTY" },
  { country: "CL", kind: "VAT", ratePct: 19, basis: "CIF_PLUS_DUTY" },
  { country: "CO", kind: "VAT", ratePct: 19, basis: "CIF_PLUS_DUTY" },
  { country: "IN", kind: "IGST", ratePct: 18, basis: "CIF_PLUS_DUTY" },
  { country: "AE", kind: "VAT", ratePct: 5, basis: "CIF_PLUS_DUTY" },
  { country: "SA", kind: "VAT", ratePct: 15, basis: "CIF_PLUS_DUTY" },
  { country: "IL", kind: "VAT", ratePct: 17, basis: "CIF_PLUS_DUTY" },
  { country: "ZA", kind: "VAT", ratePct: 15, basis: "CIF_PLUS_DUTY" },
  { country: "TR", kind: "VAT", ratePct: 20, basis: "CIF_PLUS_DUTY" },
  { country: "EG", kind: "VAT", ratePct: 14, basis: "CIF_PLUS_DUTY" },
  { country: "NG", kind: "VAT", ratePct: 7.5, basis: "CIF_PLUS_DUTY" },
].map((r) => ({ regionCode: null, localityCode: null, ...r }));

// US states that levy sales tax. Oregon / Montana / New Hampshire / Delaware /
// Alaska = no state sales tax (seeded as NONE so the engine returns an empty
// breakdown with no unsupported-regime warning).
const US_STATES: Seed[] = [
  ["AL", 4.00], ["AZ", 5.60], ["AR", 6.50], ["CA", 7.25], ["CO", 2.90],
  ["CT", 6.35], ["FL", 6.00], ["GA", 4.00], ["HI", 4.00], ["ID", 6.00],
  ["IL", 6.25], ["IN", 7.00], ["IA", 6.00], ["KS", 6.50], ["KY", 6.00],
  ["LA", 4.45], ["ME", 5.50], ["MD", 6.00], ["MA", 6.25], ["MI", 6.00],
  ["MN", 6.875], ["MS", 7.00], ["MO", 4.225], ["NE", 5.50], ["NV", 6.85],
  ["NJ", 6.625], ["NM", 4.875], ["NY", 4.00], ["NC", 4.75], ["ND", 5.00],
  ["OH", 5.75], ["OK", 4.50], ["PA", 6.00], ["RI", 7.00], ["SC", 6.00],
  ["SD", 4.20], ["TN", 7.00], ["TX", 6.25], ["UT", 6.10], ["VT", 6.00],
  ["VA", 5.30], ["WA", 6.50], ["WV", 6.00], ["WI", 5.00], ["WY", 4.00],
  ["DC", 6.00],
].map(([region, rate]) => ({
  country: "US",
  regionCode: String(region),
  localityCode: null,
  kind: "SALES_TAX",
  ratePct: Number(rate),
  basis: "TRANSACTION",
}));
const US_NOMAD_STATES: Seed[] = [["AK", 0], ["DE", 0], ["MT", 0], ["NH", 0], ["OR", 0]].map(
  ([region]) => ({
    country: "US",
    regionCode: String(region),
    localityCode: null,
    kind: "NONE",
    ratePct: 0,
    basis: "TRANSACTION",
  }),
);

// Canada — combined provincial/federal rates (HST where applicable, else
// GST + PST/QST added together).
const CA_PROVINCES: Seed[] = [
  { region: "AB", kind: "GST", rate: 5 },
  { region: "BC", kind: "GST", rate: 5 },
  { region: "BC", kind: "PST", rate: 7 },
  { region: "MB", kind: "GST", rate: 5 },
  { region: "MB", kind: "PST", rate: 7 },
  { region: "NB", kind: "HST", rate: 15 },
  { region: "NL", kind: "HST", rate: 15 },
  { region: "NS", kind: "HST", rate: 14 },
  { region: "NT", kind: "GST", rate: 5 },
  { region: "NU", kind: "GST", rate: 5 },
  { region: "ON", kind: "HST", rate: 13 },
  { region: "PE", kind: "HST", rate: 15 },
  { region: "QC", kind: "GST", rate: 5 },
  { region: "QC", kind: "QST", rate: 9.975 },
  { region: "SK", kind: "GST", rate: 5 },
  { region: "SK", kind: "PST", rate: 6 },
  { region: "YT", kind: "GST", rate: 5 },
].map((r) => ({
  country: "CA",
  regionCode: r.region,
  localityCode: null,
  kind: r.kind,
  ratePct: r.rate,
  basis: "CIF_PLUS_DUTY",
}));

const ALL: Seed[] = [
  ...EU_VAT,
  ...REST_OF_WORLD,
  ...US_STATES,
  ...US_NOMAD_STATES,
  ...CA_PROVINCES,
];

async function main() {
  let inserted = 0;
  for (const row of ALL) {
    await prisma.$executeRaw`
      INSERT INTO tax_rates
        (country, region_code, locality_code, kind, rate_pct, basis, status, source, verified_at)
      VALUES
        (${row.country}, ${row.regionCode}, ${row.localityCode},
         ${row.kind}, ${row.ratePct}, ${row.basis},
         'verified', 'manual', NOW())
      ON CONFLICT (country, region_code, locality_code, kind) DO UPDATE SET
        rate_pct = EXCLUDED.rate_pct,
        basis    = EXCLUDED.basis,
        status   = EXCLUDED.status,
        source   = EXCLUDED.source,
        updated_at = NOW()
    `;
    inserted++;
  }
  console.log(`Seeded ${inserted} tax_rates rows.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
