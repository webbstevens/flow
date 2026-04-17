-- Backfill: enforce requires_review=true for any classification record whose
-- confidence_score is below the updated 80-point threshold.
--
-- Idempotent. Safe to re-run.
--
-- Run with:
--   npx prisma db execute --file scripts/backfill-compliance-review-flag.sql --schema prisma/schema.prisma

UPDATE classification_records
SET requires_review = true
WHERE confidence_score < 80
  AND requires_review = false;
