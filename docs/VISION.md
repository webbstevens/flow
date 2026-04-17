# Flow — Product Vision

**Status:** Living document. Last material update: 2026-04-17.
**Scope:** Strategic "why" and API taxonomy. Implementation details live in code; operational rules live in `AGENTS.md` / `CLAUDE.md`.

---

## 1. The thesis

A peer-to-peer marketplace seller should be able to list a product once, with minimal inputs, and offer it **Delivered Duty Paid (DDP) at a fixed on-page price to any country in the world** — with confidence that the package will clear customs on arrival.

Today that's impossible for all but enterprise merchants. HS classification, regulatory dossiers, landed-cost math, restricted-party screening, and carrier integrations are each specialist disciplines. Flow's job is to collapse them into a single API surface that a marketplace can embed so any seller — individual or business — inherits enterprise-grade cross-border capability by default.

Flow is an **infrastructure layer**, not a merchant-facing product. Our users are marketplaces and platforms; their users are the sellers and buyers.

---

## 2. The three jobs

Everything Flow does serves one of three jobs:

1. **Enrich** — Take limited product information (title, image, maybe a URL) and decorate it with everything needed for (a) a correct HS code and (b) high confidence of clearing customs in any destination. This includes regulatory attributes per PGA (wildlife species, CAS numbers, standards compliance, etc.) that are invisible on a product page but mandatory on a commercial invoice or 3-177.

2. **Price** — At list time, on the product page, before any purchase intent, produce a landed-cost quote (product + duty + tax + freight + insurance + fees) for any destination country. The price the buyer sees includes everything; the seller gets paid the listed product price minus platform fees.

3. **Execute** — At purchase, compile a carrier-ready JSON payload containing everything needed to print a label, populate a commercial invoice, and satisfy PGA filings (FWS 3-177, FDA Prior Notice, CPSC GCC, USMCA CoO, etc.). Transmit to a carrier or label printer. Clear customs.

Demo / near-term scope focuses on Jobs 1 and 3 end-to-end. Job 2 is scoped down to an estimate (no guarantee) until the economic model is resolved — see §6.

---

## 3. The five API domains

Three jobs map to five durable API surfaces plus two cross-cutting concerns. These are the stable names we organize around; individual endpoints live in code.

### 3.1 Classification & Enrichment *(exists; extend)*
Given a product input, produce HS10, country of origin, materials, MID, and the per-PGA regulatory attributes required for the product's HS chapter. Returns rationale + precedents for auditability.

### 3.2 Compliance Dossier *(partial; promote to shipment scope)*
Given a (product, origin, destination) or (shipment), return the set of required documents and filings, the data completeness against each, and a GRYG summary. Already exists at classification-record scope. Needs extension to shipment scope and a completeness score that tells the seller what's still missing.

### 3.3 Landed Cost / DDP Quote *(missing — largest gap)*
Given (product, destination, optionally buyer address and quantity), return the guaranteed landed cost with line-item breakdown. Must be fast enough to run on product-page load and reliable enough that the marketplace can commit to the price. Supports single-point and bulk (one product → all 195 countries) queries.

### 3.4 Shipment Assembly *(missing)*
Party management (sellers, buyers, importers of record — with tax IDs, EORI, etc.), shipment graph (multi-line orders with Incoterms, mode, service level), and a canonical payload compiler that produces a WCO-aligned JSON suitable for any carrier.

### 3.5 Carrier Transmission *(missing)*
Thin adapters that translate the canonical payload into carrier-specific requests (EasyPost, FedEx, UPS, DHL, Swap OS if targeted), submit, and receive webhooks. The canonical layer is the abstraction boundary; adapters are replaceable.

### 3.6 Cross-cutting: Restricted Party Screening
OFAC SDN, BIS Consolidated, embargoed destinations. Called by both quoting (decline to price) and shipment submit (block transmission). Free government lists are adequate to start.

### 3.7 Cross-cutting: Reference Data
Agencies + certificate catalog (exist), tariff schedules, de minimis thresholds, FTA eligibility by lane, currency conversion. Mostly static; owned as reference tables, refreshed on schedule.

---

## 4. Current state vs. the vision

| Domain | Today | What's missing |
|---|---|---|
| Classification & Enrichment | HS, origin, materials, MID, rationale, precedents | Per-PGA regulatory attributes on Product |
| Compliance Dossier | GRYG bar per classification record + full catalog drawer | Promotion to shipment scope; completeness scoring |
| Landed Cost / DDP Quote | — | Entire domain |
| Shipment Assembly | — | Parties, Shipments, ShipmentLines, canonical compiler |
| Carrier Transmission | — | Adapter interface + at least one working adapter |
| Restricted Party Screening | — | OFAC/BIS check before quote + submit |
| Reference Data | Agency + certificate catalog (seeded) | Tariff / de-minimis / FTA data |

---

## 5. Architectural principles

- **Canonical first, adapters at the edge.** Payloads target the WCO Data Model shape. Carrier-specific formats (EasyPost, Swap OS, FedEx, UPS) are thin transformation layers. Never model the domain against a single carrier.
- **Data-driven validation.** The regulation catalog tells the system which attributes are required for a given HS chapter. Zod schemas derive from catalog rows, not hand-maintained code.
- **Audit-grade by default.** Every AI-produced value carries source + confidence + rationale. Operators can override; overrides are logged. Nothing is opaque.
- **Reference data in Postgres, not prompts.** Agencies, certificates, tariff schedules, de minimis rules — all queryable tables. LLMs read from them, not the other way around.
- **Idempotency on every write endpoint.** Marketplaces retry; duplicate shipments are unacceptable.
- **Flow is not a system of record for orders.** If a marketplace already has the order graph, we accept it as input. We own the compliance + customs dossier, not the commerce transaction.

---

## 6. Non-goals (today)

- **Flow is not a carrier.** We don't print labels; we hand off to carriers or label services.
- **Flow is not a licensed customs broker.** PGA filings route through a broker adapter; we produce the data, not the filing credentials.
- **Flow is not a merchant of record.** We don't take title to goods or remit VAT as the seller. Marketplaces remain the MoR.
- **Flow is not a landed-cost insurer (yet).** Quotes today carry a confidence band, not a hard guarantee. See §7.
- **Flow is not a returns platform.** Returns are out of scope until forward flows are solid.
- **Flow does not own inventory, warehousing, or fulfillment.**

---

## 7. Open strategic questions

These gate major design decisions. Flagged rather than pretended-resolved.

1. **Landed-cost guarantee model.** Quote-with-buffer vs. hard guarantee vs. partner-with-insurer (Zonos model). Determines quote-engine accuracy requirements and downstream economics.
2. **Carrier-adapter priority.** EasyPost first (fastest dev path, public sandbox), Swap OS first (internal dogfooding), or direct carrier (FedEx/UPS — more control, more work). Each implies different economics and timelines.
3. **Order ownership.** Do marketplaces push orders to Flow, or does Flow receive webhook events from an upstream commerce platform and derive shipments? Determines whether our Shipment table owns commercial terms or references external IDs.
4. **Merchant-of-record positioning.** Long term: stay infrastructure (MoR stays with marketplace) or offer MoR-as-a-service for platforms that don't want to handle VAT? Massively different regulatory and capital footprint.
5. **PGA filing path.** White-labeled broker partnership vs. building filer capability. Filer capability requires CBP bonds and legal posture we don't want in V1.

---

## 8. What this document is not

- Not an implementation plan. Sequencing and PR roadmaps live in GitHub milestones and `TODO` discussion, not here.
- Not an agent-behavior config. `AGENTS.md` and `CLAUDE.md` govern how Claude Code behaves in this repo. This document governs *what we're building and why*.
- Not a public-facing marketing page.

Update this doc when the thesis, the jobs, the domain taxonomy, or the strategic questions change. Leave operational details and endpoint specs to the code.
