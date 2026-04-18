import { type NextRequest } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { errorResponse } from "@/lib/errors";
import { ErrorCodes } from "@/lib/error-codes";
import { landedCostRequestSchema } from "@/lib/validation";
import { buildLandedCostEnvelope } from "@/lib/landed-cost/aggregator";
import type { LandedCostRequest } from "@/lib/landed-cost/types";

/**
 * POST /v1/landed-cost/quotes (VISION.md §3.3)
 *
 * Primary Landed Cost endpoint. Accepts one product + 1..N destinations,
 * returns a full landed-cost envelope per destination. Every numeric
 * field is audit-wrapped per §4.3. Idempotent via `Idempotency-Key`.
 *
 * v1 scaffold:
 *   - tax engine is real (DB-backed `tax_rates`)
 *   - all other engines are deterministic stubs (source: "stub_v1",
 *     confidence: 0)
 *   - `destination_hs_codes` is always `[]` — populated in v2 from
 *     free feeds (US HTS, EU TARIC, UK UKGT, CA CBSA).
 *   - guarantee.kind is "estimate"; carrier-account payer slots are
 *     marketplace_account by default. The quoted/partnered-underwriter
 *     paths flip these in later PRs without a shape change.
 */
export const POST = apiHandler(
  { auth: true, meter: "landed_cost.quote" },
  async (request: NextRequest, _ctx, { requestId }) => {
    const body = await request.json().catch(() => null);
    const parsed = landedCostRequestSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse({
        code: ErrorCodes.VALIDATION_ERROR,
        message: parsed.error.issues[0].message,
        status: 400,
        requestId,
      });
    }

    const envelope = await buildLandedCostEnvelope(
      parsed.data as LandedCostRequest,
    );

    return Response.json({ status: "success", data: envelope });
  },
);
