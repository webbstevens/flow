/**
 * E2E: Regression — re-run classify with the golden source URL and compare
 * HS code chapter (first 4 digits) against the stored golden fixture.
 *
 * Skipped unless ANTHROPIC_API_KEY is present in the environment, so this
 * never runs in mocked / offline CI but CAN be run manually to verify that
 * Claude hasn't drifted.
 *
 *   ANTHROPIC_API_KEY=sk-... DATABASE_URL=... npx playwright test classify-regression
 */

import { test, expect } from "@playwright/test";
import { GOLDEN_URL, GOLDEN_PHOTO } from "./fixtures/golden";

const hasApiKey = !!process.env.ANTHROPIC_API_KEY;

test.describe("Classification regression (requires ANTHROPIC_API_KEY)", () => {
  test.skip(!hasApiKey, "Skipped: ANTHROPIC_API_KEY not set");

  test.use({ viewport: { width: 1280, height: 800 } });

  test("re-classifying the golden URL returns the same HS chapter", async ({ page }) => {
    const goldenChapter = GOLDEN_URL.data.classification.hs_code.slice(0, 4);
    const sourceUrl = GOLDEN_URL.data.source.product_url!;

    // Do NOT mock the API — let the real classify endpoint run.
    await page.goto("/classify");
    await page.getByPlaceholder(/https:\/\/www\.example\.com/).fill(sourceUrl);
    await page.getByRole("button", { name: /^classify$/i }).click();

    // Wait up to 30 s for a real Claude response.
    const hsLocator = page.locator("p.font-serif.text-\\[3rem\\]").first();
    await expect(hsLocator).not.toBeEmpty({ timeout: 30_000 });

    const returnedHs = await hsLocator.textContent();
    const returnedChapter = (returnedHs ?? "").slice(0, 4);
    expect(returnedChapter).toBe(goldenChapter);
  });

  test("re-classifying via photo upload returns same HS chapter", async ({ page }) => {
    import path from "node:path";
    const FIXTURE_JPEG = path.join(__dirname, "fixtures", "test-product.jpg");
    const goldenChapter = GOLDEN_PHOTO.data.classification.hs_code.slice(0, 4);

    await page.goto("/classify");
    await page.getByRole("button", { name: /^photo$/i }).click();
    await page.setInputFiles('input[type="file"]', FIXTURE_JPEG);
    await page.getByRole("button", { name: /^classify$/i }).click();

    const hsLocator = page.locator("p.font-serif.text-\\[3rem\\]").first();
    await expect(hsLocator).not.toBeEmpty({ timeout: 30_000 });

    const returnedHs = await hsLocator.textContent();
    const returnedChapter = (returnedHs ?? "").slice(0, 4);
    expect(returnedChapter).toBe(goldenChapter);
  });
});
