-- PR 5 (Option C / #15) — drop the legacy requirements cache.
-- Superseded by classification_catalog_annotations. No callers remain
-- after requirements.ts was slimmed to types-only.
DROP TABLE IF EXISTS classification_requirements;
