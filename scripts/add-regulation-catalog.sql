-- Registry of US federal regulatory agencies that can touch imports +
-- canonical catalog of the documents / certificates they can require.
-- Idempotent — safe to re-run.

CREATE TABLE IF NOT EXISTS regulation_agencies (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code               text NOT NULL UNIQUE,
  name               text NOT NULL,
  parent_department  text NOT NULL,
  scope              text NOT NULL,
  pga_code           text,
  url                text,
  status             text NOT NULL,
  source             text NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  verified_at        timestamptz
);

CREATE TABLE IF NOT EXISTS certificate_catalog (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                    text NOT NULL UNIQUE,
  agency_code             text NOT NULL REFERENCES regulation_agencies(code) ON DELETE RESTRICT,
  title                   text NOT NULL,
  form_number             text,
  description             text NOT NULL,
  triggering_hs_chapters  jsonb NOT NULL DEFAULT '[]'::jsonb,
  default_severity        text NOT NULL,
  url                     text,
  status                  text NOT NULL,
  source                  text NOT NULL,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  verified_at             timestamptz
);

CREATE INDEX IF NOT EXISTS certificate_catalog_agency_code_idx
  ON certificate_catalog (agency_code);
