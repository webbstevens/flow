-- Add two tables backing the audit-grade split: rationale + CROSS precedents.
--
--   classification_rationales  — GRI steps + section/chapter note review,
--     keyed on (hs_code, attributes_hash) so identical products share a row.
--   cross_ruling_matches       — CROSS precedent cache, keyed on (HS6, query_hash).
--     v1 ships as a stub (rulings='[]'); real fetcher slots in later.
--
-- Idempotent. Safe to re-run.
--
-- Run with:
--   npx prisma db execute --file scripts/add-classification-rationales.sql
-- (Prisma 7 auto-loads prisma.config.ts; no --schema flag.)

CREATE TABLE IF NOT EXISTS classification_rationales (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hs_code         TEXT NOT NULL,
  attributes_hash TEXT NOT NULL,
  gri_steps       JSONB NOT NULL DEFAULT '[]',
  notes_reviewed  JSONB NOT NULL DEFAULT '[]',
  status          TEXT NOT NULL,
  source          TEXT NOT NULL,
  confidence      INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_at     TIMESTAMPTZ,
  UNIQUE (hs_code, attributes_hash)
);

CREATE INDEX IF NOT EXISTS classification_rationales_hs_idx
  ON classification_rationales(hs_code);

CREATE TABLE IF NOT EXISTS cross_ruling_matches (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hs_code_prefix TEXT NOT NULL,
  query_hash     TEXT NOT NULL,
  rulings        JSONB NOT NULL DEFAULT '[]',
  source         TEXT NOT NULL,
  status         TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at     TIMESTAMPTZ,
  UNIQUE (hs_code_prefix, query_hash)
);

CREATE INDEX IF NOT EXISTS cross_ruling_matches_hs6_idx
  ON cross_ruling_matches(hs_code_prefix);
