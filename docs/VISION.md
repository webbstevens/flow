# Flow — Product Vision

**Status:** Living document. Last material update: 2026-04-17.
**Scope:** Strategic "why" and API taxonomy. Implementation details live in code; operational rules live in `AGENTS.md` / `CLAUDE.md`.

---

## 1. The thesis

A peer-to-peer marketplace seller should be able to list a product once, with minimal inputs, and offer it **Delivered Duty Paid (DDP) at a fixed on-page price to any country in the world** — with confidence that the package will clear customs on arrival.

Today that's impossible for all but enterprise merchants. HS classification, regulatory dossiers, landed-cost math, restricted-party screening, and carrier integrations are each specialist disciplines. Flow's job is to collapse them into a single API surface that a marketplace can embed so any seller — individual or business — inherits enterprise-grade cross-border capability by default.

Flow is an **infrastructure layer**, not a merchant-facing product. Our primary consumers are marketplaces and aggregators calling the API on behalf of many sellers; a single large merchant can call the same API for themselves without any special positioning — the only difference is one field (`on_behalf_of` / `seller_id`) on each request. We do not ship a seller-facing login or dashboard.

---

## 2. The three jobs

Everything Flow does serves one of three jobs:

1. **Enrich** — Take limited product information (title, image, maybe a URL) and decorate it with everything needed for (a) a correct HS code and (b) high confidence of clearing customs in any destination. This includes regulatory attributes per PGA (wildlife species, CAS numbers, standards compliance, etc.) that are invisible on a product page but mandatory on a commercial invoice or 3-177.

2. **Price** — At list time, on the product page, before any purchase intent, produce a landed-cost quote (product + duty + tax + freight + insurance + fees) for any destination country. The price the buyer sees includes everything; the seller gets paid the listed product price minus platform fees.

3. **Execute** — At purchase, compile a carrier-ready JSON payload containing everything needed to print a label, populate a commercial invoice, and satisfy PGA filings (FWS 3-177, FDA Prior Notice, CPSC GCC, USMCA CoO, etc.). Transmit to a carrier or label printer. Clear customs.

Demo / near-term scope focuses on Jobs 1 and 3 end-to-end. Job 2 is scoped down to an estimate (no guarantee) until the economic model is resolved — see §6.

---

## 3. The four services

Flow is **one API product with four internal services**, not one monolith and not a microservice grid. Externally consumers see a single base URL, single auth, single SDK. Internally the surface is organized into four domains that each pass four tests: a market category exists, data is cohesive within, caller profile is coherent, and the implementation is replaceable at the seam (build or buy).

Reference data (agencies, certificates, tariff schedules, de minimis, FTA, country codes) backs all four services but is not itself a service — it's shared infrastructure exposed read-only.

### 3.1 Classification *(exists; extend)*
**"What is this product?"**
HS10, country of origin, MID, materials, and per-PGA regulatory attributes required for the product's HS chapter. Returns rationale + precedents for auditability. Called at product ingestion. Replaceable by Zonos Classify / 3CE / Avalara Classify behind an adapter.

### 3.2 Compliance *(partial)*
**"Is this ok to ship, and what does it need?"**
Per-lane dossier, required documents, restricted-party + sanctions screening, declaration-data completeness, GRYG scoring. Combines what were previously separate "dossier" and "screening" concerns because they answer the same meta-question from opposite sides (what's needed vs. what's blocked). Called by Pricing (to decline restricted) and Fulfillment (to block submit).

### 3.3 Pricing *(partial — v1 scaffold landed)*
**"What will this cost landed?"**
Duty, tax, freight, fees, insurance, FTA eligibility, de minimis awareness. Highest-volume and lowest-latency surface — runs on product-page load for a marketplace browsing experience. Single-point and bulk (one product → all 195 countries) queries. Replaceable by Zonos Landed Cost / Avalara Cross-Border / Hurricane behind an adapter.

### 3.4 Fulfillment *(missing)*
**"Actually ship it."**
Party management (seller / buyer / importer of record with tax IDs, EORI, etc.), shipment graph (multi-line orders with Incoterms, mode, service level), canonical payload compilation (WCO-aligned JSON), carrier adapters (EasyPost / Swap OS / FedEx / UPS / DHL), transmission, webhooks. Transactional, lower-volume, higher-stakes than Pricing.

---

## 4. Surface-area tenets

Rules any consumer can observe and depend on. Written as constraints on the public API contract, not implementation guidance.

1. **One product, one auth.** Single base URL, single API key scheme, single SDK. Internal service boundaries are invisible to consumers. Endpoints are resource-oriented (`/shipments/:id/submit`), not RPC (`/submitShipment`).

2. **Idempotent writes by default.** Every write accepts a client-provided idempotency key. Retries never duplicate shipments, quotes, or submissions. Especially critical at `/shipments/:id/submit`, `/quotes/landed-cost`, and any LLM-backed write.

3. **Audit-grade responses.** Every AI-derived or vendor-derived field ships with `{ value, source, confidence, derived_at }`. No opaque values in consumer-facing payloads. Operator overrides are explicit and logged.

4. **Reference data is read-only and cacheable.** `/catalog/*` and `/lanes/*` responses are immutable per version. Consumers cache aggressively; we bump versions, we don't mutate values in place.

5. **No hidden orchestration.** Endpoints do one observable thing. If an operation crosses services (e.g. submit → screen → compile → transmit), it's either a single composition endpoint with clearly documented side effects, or the consumer orchestrates. Never invisible cascading writes.

6. **Webhook-first for state changes.** Any asynchronous state transition (shipment submitted, customs cleared, screening flagged) emits a signed webhook to registered endpoints. Replayable. Polling is the fallback, not the default.

7. **Versioning per module, not per endpoint.** Module-scoped paths (`/v1/quotes`, `/v2/quotes`) let one service advance without dragging the others. Additive changes don't bump versions; breaking changes do, deliberately.

8. **Standard error contract.** Every error: `{ code, message, request_id, docs_url }`. Machine-readable code + human message + link to the exact docs section. No endpoint-specific error shapes.

---

## 5. Current state vs. the vision

| Service | Today | What's missing |
|---|---|---|
| Classification | HS, origin, materials, MID, rationale, precedents | Per-PGA regulatory attributes on Product |
| Compliance | GRYG bar per classification record + full catalog drawer | Shipment scope, completeness scoring, restricted-party screening |
| Pricing | `POST /v1/landed-cost/quotes` with audit-graded envelope; real DB-backed tax engine (EU VAT, US state sales tax, CA GST/PST/QST/HST, IGST); stub duty / FTA / freight / de-minimis / FX | Quote persistence + retrieval, real duty feeds, per-destination HS codes, FTA rule-of-origin logic, hard guarantee model |
| Fulfillment | — | Parties, Shipments, canonical compiler, carrier adapters, webhooks |
| Reference data (shared) | Agencies + certificate catalog + tax_rates (seeded) | Tariff schedules, de-minimis, FTA, country data |

---

## 6. Architectural principles

These are internal rules that keep the surface-area tenets achievable over time.

- **Canonical first, adapters at the edge.** Payloads target the WCO Data Model shape. Carrier-specific formats (EasyPost, Swap OS, FedEx, UPS) are thin transformation layers. Never model the domain against a single vendor.
- **Services talk via APIs, not cross-service DB reads.** Compliance asking Classification for a product's HS reads `/products/:id`; it does not `SELECT` from the products table directly. This is what keeps the seams replaceable.
- **Data-driven validation.** The regulation catalog tells the system which attributes are required for a given HS chapter. Zod schemas derive from catalog rows, not hand-maintained code.
- **Audit-grade by default.** Every AI-produced or vendor-derived value carries source + confidence + rationale. Operators can override; overrides are logged.
- **Reference data in Postgres, not prompts.** Agencies, certificates, tariff schedules, de minimis rules — all queryable tables. LLMs read from them, not the other way around.
- **Flow is not a system of record for orders.** If a marketplace already has the order graph, we accept it as input and reference it by ID. We own the compliance + customs dossier, not the commerce transaction.
- **One caller model.** Every request is made by an authenticated consumer acting either as a facilitator for a seller or as the seller itself. The API shape is identical in both cases — a single `on_behalf_of` (or equivalent) field disambiguates. No separate "marketplace API" vs. "merchant API" surfaces.
- **Each service passes the four-test.** Before adding a service or splitting one, answer: is there a market? Is the data cohesive? Is the caller profile coherent? Is it replaceable at the seam? If any answer is no, rethink the boundary.

---

## 7. Non-goals (today)

- **Flow is not a carrier.** We don't print labels; we hand off to carriers or label services.
- **Flow is not a licensed customs broker.** PGA filings route through a broker adapter; we produce the data, not the filing credentials.
- **Flow is not a merchant of record.** We don't take title to goods or remit VAT as the seller. Marketplaces remain the MoR.
- **Flow is not a landed-cost insurer (yet).** Quotes today carry a confidence band, not a hard guarantee. See §7.
- **Flow is not a returns platform.** Returns are out of scope until forward flows are solid.
- **Flow does not own inventory, warehousing, or fulfillment.**
- **Flow does not ship a seller-facing UI.** Marketplaces/merchants integrate the API; any seller-facing surface is their own. The Next.js app in this repo is an ops/demo console, not a product.

---

## 8. Open strategic questions

These gate major design decisions. Flagged rather than pretended-resolved.

1. **Landed-cost guarantee model.** Quote-with-buffer vs. hard guarantee vs. partner-with-insurer (Zonos model). Determines quote-engine accuracy requirements and downstream economics.
2. **Carrier-adapter priority.** EasyPost first (fastest dev path, public sandbox), Swap OS first (internal dogfooding), or direct carrier (FedEx/UPS — more control, more work). Each implies different economics and timelines.
3. **Merchant-of-record positioning.** Long term: stay infrastructure (MoR stays with marketplace) or offer MoR-as-a-service for platforms that don't want to handle VAT? Massively different regulatory and capital footprint.
4. **PGA filing path.** White-labeled broker partnership vs. building filer capability. Filer capability requires CBP bonds and legal posture we don't want in V1.

---

## 9. What this document is not

- Not an implementation plan. Sequencing and PR roadmaps live in GitHub milestones and `TODO` discussion, not here.
- Not an agent-behavior config. `AGENTS.md` and `CLAUDE.md` govern how Claude Code behaves in this repo. This document governs *what we're building and why*.
- Not a public-facing marketing page.

Update this doc when the thesis, the jobs, the domain taxonomy, or the strategic questions change. Leave operational details and endpoint specs to the code.
