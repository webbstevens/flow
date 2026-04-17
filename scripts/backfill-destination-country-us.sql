-- Backfill: set destination_country='US' on classification records that were
-- created before the destination_country column existed (PR #4) or before
-- the default-to-US change (PR #5) took effect.
--
-- Populating the column makes the Destination row render on the analytics
-- detail page. Note: the Requirements card still won't render for these
-- records until a requirement cache row exists for their (HS6, origin, US)
-- key — that only happens the next time anyone classifies something in the
-- same subheading + origin + US corridor.
--
-- Idempotent. Safe to re-run.
--
-- Run with:
--   npx prisma db execute --file scripts/backfill-destination-country-us.sql
-- (Prisma 7 auto-loads prisma.config.ts; no --schema flag.)

UPDATE classification_records
SET destination_country = 'US'
WHERE destination_country IS NULL;
