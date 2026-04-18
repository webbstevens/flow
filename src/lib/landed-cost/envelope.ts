/**
 * Envelope construction helpers. Every numeric landed-cost field goes
 * through `auditField()` so source / confidence / derived_at are populated
 * uniformly.
 */

import type { AuditField } from "./types";

export function auditField(
  value: number,
  source: string,
  opts: { currency?: string; confidence?: number; derivedAt?: string } = {},
): AuditField {
  return {
    value: round2(value),
    currency: opts.currency,
    source,
    confidence: opts.confidence ?? 0,
    derived_at: opts.derivedAt ?? new Date().toISOString(),
  };
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}
