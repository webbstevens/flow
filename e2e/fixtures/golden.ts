/**
 * Golden classification fixtures.
 *
 * These are realistic envelope shapes derived from the actual API contract
 * (see src/lib/validation.ts classificationEnvelopeSchema).  They are used
 * as mock API responses in E2E tests so the UI always renders with real-data
 * shapes and the selectors stay honest.
 *
 * To refresh from production once auth is wired up:
 *   npx tsx e2e/fixtures/capture-golden.ts
 */

import type { Route } from "@playwright/test";

// Returned when the user classifies via a product URL.
export const GOLDEN_URL = {
  status: "success",
  data: {
    classification_id: "e3b0c442-98fc-4e0a-bdec-0a0f0b0c0d0e",
    compliance_status: "compliant",
    classification: {
      hs_code: "6109.10.0012",
      coo: "CN",
      mid_code: "CNGDWID123456",
      customs_description: "Men's cotton T-shirt, knitted",
      materials: "100% cotton",
    },
    ai_metadata: {
      confidence_score: 92,
      requires_review: false,
      attributes: {
        gender: "men",
        fabric_weight: "180gsm",
        closure_type: "pullover",
      },
    },
    actionable_flags: {
      missing_required_fields: [],
      warnings: [],
      restricted_goods_flag: false,
    },
    source: {
      product_url: "https://www.ebay.co.uk/itm/365500972148",
      title: "Men's Plain Cotton T-Shirt",
    },
    image_url: null,
    created_at: "2026-06-20T10:30:00.000Z",
  },
};

// Returned when the user classifies via a photo upload.
export const GOLDEN_PHOTO = {
  status: "success",
  data: {
    classification_id: "f4c1d553-a9fd-5f1b-cefd-1b1f1c1d1e1f",
    compliance_status: "partially_compliant",
    classification: {
      hs_code: "4202.22.4500",
      coo: "IT",
      mid_code: "",
      customs_description: "Leather handbag with shoulder strap",
      materials: "genuine leather exterior, textile lining",
    },
    ai_metadata: {
      confidence_score: 78,
      requires_review: true,
      attributes: {
        color: "tan",
        closure: "magnetic snap",
        compartments: "2",
      },
    },
    actionable_flags: {
      missing_required_fields: ["brand"],
      warnings: [
        {
          code: "LOW_CONFIDENCE",
          message: "Confidence below 80% — manual review recommended.",
        },
      ],
      restricted_goods_flag: false,
    },
    source: {
      product_url: null,
      title: null,
    },
    image_url:
      "https://hqsxmazcujvxueknxijp.supabase.co/storage/v1/object/public/classify-images/test/handbag.jpg",
    created_at: "2026-06-21T14:15:00.000Z",
  },
};

export const EMPTY_HISTORY = { data: [], pagination: { page: 1, limit: 12, total: 0 } };

// ─── route helper ─────────────────────────────────────────────────────────────

export type GoldenKey = "url" | "photo" | "blocked" | "server-error";

const BLOCKED_RESPONSE = {
  code: "scrape_failed",
  message:
    "www.ebay.co.uk blocked the request (403). Try switching to Photo mode — take or upload a photo of the product instead.",
  request_id: "req_test_blocked",
  docs_url: "https://docs.flow.dev/errors/scrape_failed",
};

const SERVER_ERROR_RESPONSE = {
  code: "internal_error",
  message: "An unexpected error occurred.",
  request_id: "req_test_error",
  docs_url: "https://docs.flow.dev/errors/internal_error",
};

export async function fulfillClassify(route: Route, key: GoldenKey) {
  switch (key) {
    case "url":
      return route.fulfill({ json: GOLDEN_URL });
    case "photo":
      return route.fulfill({ json: GOLDEN_PHOTO });
    case "blocked":
      return route.fulfill({ status: 400, json: BLOCKED_RESPONSE });
    case "server-error":
      return route.fulfill({ status: 500, json: SERVER_ERROR_RESPONSE });
  }
}
