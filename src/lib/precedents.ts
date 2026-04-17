/**
 * Classification precedents — CROSS ruling matches.
 *
 * v1 is a stub. CBP CROSS (rulings.cbp.gov) doesn't publish a documented
 * API and scraping + reranking rulings against product attributes is a
 * whole subsystem. The endpoint ships now with a stable response shape and
 * a "closed beta" notice so integrations can wire against it; the real
 * fetcher drops into `fetchCrossRulings()` later without breaking callers.
 *
 * Lifecycle mirrors the rationale + requirements modules.
 *
 * Cache key is (HS6, query_hash) — broader than HS10 because rulings at
 * sibling subheadings are often equally relevant.
 */

import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hs6 } from "@/lib/requirements";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type PrecedentsStatus =
  | "flow_validating"
  | "verified"
  | "manual_override";

export type PrecedentsSource = "cross_stub" | "cross_scrape" | "cross_api";

export type CrossRuling = {
  ruling_number: string; // e.g. "NY N123456" or "HQ H987654"
  date: string; // ISO date
  hs_code: string;
  product: string; // short description
  url: string;
  relevance: number; // 0-100 rerank score
};

export interface PrecedentsEnvelope {
  classification_id: string;
  hs_code: string;
  hs6: string;
  status: PrecedentsStatus;
  source: PrecedentsSource;
  rulings: CrossRuling[];
  notice: string | null;
  updated_at: string;
  expires_at: string | null;
}

export interface PrecedentsInput {
  recordId: string;
  hsCode: string;
  title: string | null;
  materials: string | null;
}

const CLOSED_BETA_NOTICE =
  "CROSS precedent matching is in closed beta. The endpoint shape is stable, but the ruling list will be populated in a later release. Contact support for manual lookups in the meantime.";

// ---------------------------------------------------------------------------
// Hashing
// ---------------------------------------------------------------------------

export function hashQuery(
  hsCode: string,
  title: string | null,
  materials: string | null,
): string {
  const norm = (s: string | null) =>
    (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  const input = [hsCode, norm(title), norm(materials)].join("|");
  return createHash("sha256").update(input).digest("hex");
}

// ---------------------------------------------------------------------------
// Cache read
// ---------------------------------------------------------------------------

export async function findCachedPrecedents(
  hsCode: string,
  queryHash: string,
  classificationId: string,
): Promise<PrecedentsEnvelope | null> {
  const row = await prisma.crossRulingMatch.findUnique({
    where: {
      hsCodePrefix_queryHash: { hsCodePrefix: hs6(hsCode), queryHash },
    },
  });
  if (!row) return null;
  return rowToEnvelope(row, classificationId);
}

// ---------------------------------------------------------------------------
// getOrInfer — cache-then-stub-then-persist
//
// When the real fetcher ships, replace the `stubEnvelope` call below with
// `await fetchCrossRulings(input)` and adjust `source` / `status` / `notice`.
// ---------------------------------------------------------------------------

export async function getOrInferPrecedents(
  input: PrecedentsInput,
): Promise<PrecedentsEnvelope | null> {
  const queryHash = hashQuery(input.hsCode, input.title, input.materials);

  const cached = await findCachedPrecedents(
    input.hsCode,
    queryHash,
    input.recordId,
  );
  if (cached) return cached;

  const stub = stubInference();

  const row = await prisma.crossRulingMatch.upsert({
    where: {
      hsCodePrefix_queryHash: {
        hsCodePrefix: hs6(input.hsCode),
        queryHash,
      },
    },
    create: {
      hsCodePrefix: hs6(input.hsCode),
      queryHash,
      rulings: stub.rulings,
      source: stub.source,
      status: stub.status,
    },
    update: {}, // no-op on race
  });

  return rowToEnvelope(row, input.recordId);
}

// ---------------------------------------------------------------------------
// Row → Envelope
// ---------------------------------------------------------------------------

interface PrecedentsRow {
  hsCodePrefix: string;
  rulings: unknown;
  status: string;
  source: string;
  updatedAt: Date;
  expiresAt: Date | null;
}

function rowToEnvelope(
  row: PrecedentsRow,
  classificationId: string,
): PrecedentsEnvelope {
  const rulings: CrossRuling[] = Array.isArray(row.rulings)
    ? (row.rulings as CrossRuling[])
    : [];
  const source = row.source as PrecedentsSource;
  return {
    classification_id: classificationId,
    hs_code: row.hsCodePrefix,
    hs6: row.hsCodePrefix,
    status: row.status as PrecedentsStatus,
    source,
    rulings,
    notice: source === "cross_stub" ? CLOSED_BETA_NOTICE : null,
    updated_at: row.updatedAt.toISOString(),
    expires_at: row.expiresAt ? row.expiresAt.toISOString() : null,
  };
}

// ---------------------------------------------------------------------------
// Stub — returned until the real fetcher ships
// ---------------------------------------------------------------------------

function stubInference(): {
  rulings: CrossRuling[];
  status: PrecedentsStatus;
  source: PrecedentsSource;
} {
  return {
    rulings: [],
    status: "flow_validating",
    source: "cross_stub",
  };
}
