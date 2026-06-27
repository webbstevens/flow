import type { Page } from "@playwright/test";
import { fulfillClassify, EMPTY_HISTORY, type GoldenKey } from "../fixtures/golden";

/**
 * Intercepts the classify and history API routes so tests run without a
 * real Anthropic / Prisma backend.  Call this in `test.beforeEach` or at
 * the start of an individual test.
 */
export async function mockClassifyApi(page: Page, key: GoldenKey = "url") {
  await page.route("**/api/v1/compliance/classify", (route) =>
    fulfillClassify(route, key)
  );
  await page.route("**/api/v1/compliance/history**", (route) =>
    route.fulfill({ json: EMPTY_HISTORY })
  );
}
