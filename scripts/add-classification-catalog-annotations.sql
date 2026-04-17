-- Per-lane LLM annotations on certificate_catalog. Option C refactor (#15).
-- Replaces the freehand required_documents JSON on classification_requirements
-- with one row per catalog entry per (hs6, origin, destination). Idempotent.

CREATE TABLE IF NOT EXISTS classification_catalog_annotations (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hs_code_prefix       text NOT NULL,
  origin_country       text NOT NULL,
  destination_country  text NOT NULL,
  catalog_code         text NOT NULL,
  llm_confirmed        boolean NOT NULL DEFAULT false,
  rationale            text NOT NULL,
  confidence           integer,
  severity_override    text,
  note                 text,
  status               text NOT NULL,
  source               text NOT NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  verified_at          timestamptz,
  CONSTRAINT classification_catalog_annotations_uq
    UNIQUE (hs_code_prefix, origin_country, destination_country, catalog_code)
);

CREATE INDEX IF NOT EXISTS classification_catalog_annotations_lane_idx
  ON classification_catalog_annotations (hs_code_prefix, destination_country);

CREATE INDEX IF NOT EXISTS classification_catalog_annotations_code_idx
  ON classification_catalog_annotations (catalog_code);
