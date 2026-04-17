-- Add jurisdiction + type columns to certificate_catalog so the envelope
-- (src/lib/requirements.ts) can be derived from DB rows instead of living
-- in a parallel static list. Idempotent.
--
-- After running, re-run the seeder to backfill values:
--   npm run seed:regulation-catalog

ALTER TABLE certificate_catalog
  ADD COLUMN IF NOT EXISTS jurisdiction text NOT NULL DEFAULT 'US';

ALTER TABLE certificate_catalog
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'N';

-- Severity vocabulary widens to include 'alternative' (used by EU Y-code
-- pairs). Stored as text so no enum change needed — this is a doc-only
-- line for the grep audit trail.
