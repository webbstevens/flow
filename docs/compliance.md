# Compliance service

Operational architecture for the Compliance service (VISION.md §3.2). How the
certificate catalog, per-lane annotations, and the requirement envelope fit
together — and how the Option C refactor ([#15](https://github.com/webbstevens/flow/issues/15))
re-shaped the data flow.

For the **why**, read [VISION.md §3.2](./VISION.md). For **endpoint specs**,
see the OpenAPI doc (`/api/openapi`). This file covers the internal moving
parts.

---

## Data model

```
regulation_agencies                  (~47 rows — seeded)
    │
    │  FK agency_code
    ▼
certificate_catalog                  (~100 rows — seeded)
    │   code, title, description, jurisdiction,
    │   type (C/L/U/X/N/Y/PGA), triggering_hs_chapters,
    │   default_severity, status, source
    │
    │  FK-by-value catalog_code
    ▼
classification_catalog_annotations   (per-lane LLM judgments)
    │   (hs6, origin, destination, catalog_code) → unique
    │   llm_confirmed, rationale, confidence,
    │   severity_override, status, source
```

- `regulation_agencies` and `certificate_catalog` are **shared reference data**
  — authoritative, seeded, versioned independently of classifications
  (VISION.md §3 reference-data tenet).
- `classification_catalog_annotations` is the **inference surface** — one row
  per (HS6, origin, destination, catalog entry). The LLM sees every triggered
  catalog row for a lane and answers, per row, "does this apply?"
- `classification_requirements` is the **legacy cache** — deprecated. See
  [Migration status](#migration-status-option-c-issue-15) below.

## Request flow

`POST /v1/compliance/classify` and the internal `/analytics/[id]` page both
call `buildUnifiedEnvelope()` in [`src/lib/requirements-v2.ts`](../src/lib/requirements-v2.ts).
That function:

1. Loads every catalog row whose `jurisdiction` matches the destination
   (`US`, `EU`, `UK`, or `INTL`).
2. Calls `getOrInferAnnotations()` ([`src/lib/catalog-annotations.ts`](../src/lib/catalog-annotations.ts))
   which returns cached annotations or fires a fresh LLM call annotating only
   the **triggered** rows (those whose `triggering_hs_chapters` is empty or
   contains the product's HS2 chapter).
3. Joins catalog rows + annotations into a `UnifiedEnvelope` with:
   - Legacy `required_documents[]` — back-compat projection of entries where
     `applies=true`.
   - New `catalog_entries[]` — every catalog row (even "not triggered" /
     "not applicable") with its GRYG status, rationale, and agency grouping.
   - `counts`, `agencies_reviewed`, `total_regulations` for the summary bar.

## GRYG status per entry

Derived in `deriveEntryStatus()` — single source of truth.

| Condition | Status | UI color |
|---|---|---|
| not triggered by HS chapter | `ready` | green |
| triggered, LLM says doesn't apply | `ready` | green |
| triggered, catalog still `flow_validating`, annotation not `verified` | `tbd` | gray |
| triggered + applies + `informational` | `ready` | green |
| triggered + applies + `alternative` (or `conditional`) | `manual_review` | amber |
| triggered + applies + `required` | `required` | red |

Severity vocabulary: the catalog uses `required | conditional | informational`;
the envelope exposes `required | alternative | informational`. The
`normalizeSeverity()` mapping (`conditional → alternative`) happens at the
envelope boundary so consumers see TARIC-aligned terms.

## Feature flag

`REQUIREMENTS_V2` — defaults to **on** as of PR 4. Set to `false` to roll back
to the legacy path (uses `findCachedRequirement()` + `computeDeepReview()`).
Flag will be removed in PR 5 along with the legacy code.

## Seeding the catalog

```bash
# Full seed (agencies + LLM-inferred certificates, requires ANTHROPIC_API_KEY)
npm run seed:regulation-catalog

# Schema-only backfill (no LLM, fast — picks up new static entries
# and syncs jurisdiction/type)
npx tsx --env-file=.env scripts/backfill-catalog-jurisdiction-type.ts
```

The hand-curated entries in [`src/lib/certificate-catalog.ts`](../src/lib/certificate-catalog.ts)
are the source of truth for universal commercial docs (`COMMERCIAL_INVOICE`,
`PACKING_LIST`, `BILL_OF_LADING`, `AIRWAY_BILL`, `PROFORMA_INVOICE`) and the
~13 US PGA entries that pre-date the LLM seeder. The LLM path fills in the
rest (~85 rows across ~34 agencies) and its rows stay at
`status='flow_validating'` until an operator promotes them to `verified`.

## Migration status (Option C / #15)

| PR | What | Status |
|---|---|---|
| [#29](https://github.com/webbstevens/flow/pull/29) | Add `jurisdiction` + `type` columns to `certificate_catalog` | merged |
| [#30](https://github.com/webbstevens/flow/pull/30) | New `classification_catalog_annotations` table + v2 inference | merged |
| [#31](https://github.com/webbstevens/flow/pull/31) | Unified envelope + single-list UI, flag-gated | merged |
| This PR | Flip `REQUIREMENTS_V2` default to on; deprecate legacy `required_documents` column + API field | in flight |
| PR 5 | Drop `classification_requirements` table + legacy code | pending |

Annotations populate **lazily** — the first classify call per (hs6, origin,
destination) triggers an LLM call of ~15–30 triggered rows; subsequent calls
hit the cache. No corpus-wide backfill is needed; old cache rows in
`classification_requirements` are simply ignored by the v2 path.

## Adding a new catalog entry

1. If it's universal / commercial / not tied to a specific US regulator:
   add it to `CERTIFICATE_CATALOG` in [`src/lib/certificate-catalog.ts`](../src/lib/certificate-catalog.ts)
   under agency `"NONE"` / jurisdiction `"INTL"`.
2. Run `npx tsx --env-file=.env scripts/backfill-catalog-jurisdiction-type.ts`
   to upsert into the DB.
3. If it's regulator-specific, prefer re-running the full seeder so the LLM
   associates it with the right agency and HS chapters. Or add it manually
   via SQL with `status='verified'`, `source='manual'`.

Existing annotations are **not re-evaluated** when a new catalog row lands.
They'll be filled in on the next classify call per lane.
