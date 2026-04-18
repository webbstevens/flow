-- Landed Cost v1: tax_rates table.
-- VISION.md §3.3. One row per (country, region?, locality?, kind). Scaffold
-- seeds ~135 rows covering EU VAT, UK, AU/NZ/JP/CN consumption, US state
-- sales tax, CA provincial, IN IGST flat.

CREATE TABLE IF NOT EXISTS tax_rates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country         TEXT    NOT NULL,
  region_code     TEXT,
  locality_code   TEXT,
  kind            TEXT    NOT NULL,
  rate_pct        DECIMAL(6, 4) NOT NULL,
  basis           TEXT    NOT NULL DEFAULT 'CIF',
  hs_scope        JSONB,
  status          TEXT    NOT NULL,
  source          TEXT    NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_at     TIMESTAMPTZ
);

-- Unique index. Postgres treats NULLs as distinct by default; with Postgres 15+
-- NULLS NOT DISTINCT gives us the real uniqueness we want across all 4 cols.
CREATE UNIQUE INDEX IF NOT EXISTS tax_rates_country_region_locality_kind_key
  ON tax_rates (country, region_code, locality_code, kind)
  NULLS NOT DISTINCT;

CREATE INDEX IF NOT EXISTS tax_rates_country_idx ON tax_rates (country);
