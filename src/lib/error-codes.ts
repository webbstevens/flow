/**
 * Machine-readable error codes surfaced to API consumers.
 *
 * Contract (VISION.md §4.8 — "Standard error contract"):
 *   Every error body is { code, message, request_id, docs_url }.
 *   `code` is stable; `message` is human-friendly and may change.
 */
export const ErrorCodes = {
  VALIDATION_ERROR: "validation_error",
  UNAUTHORIZED: "unauthorized",
  NOT_FOUND: "not_found",
  CONFLICT: "conflict",
  RATE_LIMITED: "rate_limited",
  SCRAPE_FAILED: "scrape_failed",
  UPSTREAM_ERROR: "upstream_error",
  INTERNAL_ERROR: "internal_error",
  IDEMPOTENCY_CONFLICT: "idempotency_conflict",
  IDEMPOTENCY_IN_PROGRESS: "idempotency_in_progress",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

export const DOCS_BASE_URL = "https://docs.flow.dev/errors";
