-- VISION.md §4.2 — idempotency-key store.
-- Run once, manually: psql "$DATABASE_URL" -f scripts/add-idempotency-keys.sql

CREATE TABLE IF NOT EXISTS idempotency_keys (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID        NOT NULL,
  method            TEXT        NOT NULL,
  path              TEXT        NOT NULL,
  key               TEXT        NOT NULL,
  request_hash      TEXT        NOT NULL,
  status_code       INTEGER,
  response_body     JSONB,
  response_headers  JSONB,
  locked_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at      TIMESTAMPTZ,
  expires_at        TIMESTAMPTZ NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idempotency_keys_scope_key_unique
  ON idempotency_keys (workspace_id, method, path, key);

CREATE INDEX IF NOT EXISTS idempotency_keys_expires_at_idx
  ON idempotency_keys (expires_at);
