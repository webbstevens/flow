-- Add destination_country to classification_records so the analytics detail
-- page can look up its cached requirement row.
ALTER TABLE classification_records
  ADD COLUMN IF NOT EXISTS destination_country TEXT;

-- Shared cache of required documents / Y-codes per (HS6, origin, destination).
-- Keyed on the 6-digit WCO HS subheading (not the full 10-digit tariff line)
-- so we get cache hits across classifications that share a subheading.
CREATE TABLE IF NOT EXISTS classification_requirements (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hs_code_prefix        TEXT NOT NULL,
  origin_country        TEXT NOT NULL,
  destination_country   TEXT NOT NULL,
  required_documents    JSONB NOT NULL DEFAULT '[]',
  warnings              JSONB NOT NULL DEFAULT '[]',
  status                TEXT NOT NULL,
  source                TEXT NOT NULL,
  confidence            INTEGER,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_at           TIMESTAMPTZ,
  UNIQUE (hs_code_prefix, origin_country, destination_country)
);

CREATE INDEX IF NOT EXISTS classification_requirements_dest_idx
  ON classification_requirements(destination_country);

-- Run with:
--   npx prisma db execute --file scripts/add-classification-requirements.sql \
--     --schema prisma/schema.prisma
