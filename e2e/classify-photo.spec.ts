/**
 * E2E: Photo classification flow — desktop + mobile viewports.
 *
 * Uses a minimal JPEG fixture (e2e/fixtures/test-product.jpg) and golden
 * photo envelope so no real Anthropic / DB connection is required.
 */

import path from "node:path";
import { test, expect } from "@playwright/test";
import { mockClassifyApi } from "./helpers/mock-classify";
import { GOLDEN_PHOTO } from "./fixtures/golden";

const FIXTURE_JPEG = path.join(__dirname, "fixtures", "test-product.jpg");
const HS_CODE = GOLDEN_PHOTO.data.classification.hs_code; // "4202.22.4500"

test.beforeEach(async ({ page }) => {
  await mockClassifyApi(page, "photo");
  await page.goto("/classify");
});

// ─── switching to Photo mode ───────────────────────────────────────────────────

test("clicking Photo tab shows the camera button", async ({ page }) => {
  await page.getByRole("button", { name: /^photo$/i }).click();
  await expect(page.getByText("Take or Choose Photo")).toBeVisible();
});

test("clicking Photo tab hides the URL input", async ({ page }) => {
  await page.getByRole("button", { name: /^photo$/i }).click();
  await expect(page.getByPlaceholder(/https:\/\/www\.example\.com/)).not.toBeVisible();
});

// ─── file upload + preview ────────────────────────────────────────────────────

test("uploading a JPEG shows an image preview", async ({ page }) => {
  await page.getByRole("button", { name: /^photo$/i }).click();
  await page.setInputFiles('input[type="file"]', FIXTURE_JPEG);
  const preview = page.locator("img[alt='Captured product']");
  await expect(preview).toBeVisible();
  const src = await preview.getAttribute("src");
  expect(src).toMatch(/^data:image\//);
});

test("after upload the 'Retake photo' link is visible", async ({ page }) => {
  await page.getByRole("button", { name: /^photo$/i }).click();
  await page.setInputFiles('input[type="file"]', FIXTURE_JPEG);
  await expect(page.getByText("Retake photo")).toBeVisible();
});

test("Classify button appears and is enabled after image is selected", async ({ page }) => {
  await page.getByRole("button", { name: /^photo$/i }).click();
  await page.setInputFiles('input[type="file"]', FIXTURE_JPEG);
  await expect(page.getByRole("button", { name: /^classify$/i })).toBeEnabled();
});

// ─── classify flow ─────────────────────────────────────────────────────────────

test("submitting a photo shows ResultCard with golden HS code", async ({ page }) => {
  await page.getByRole("button", { name: /^photo$/i }).click();
  await page.setInputFiles('input[type="file"]', FIXTURE_JPEG);
  await page.getByRole("button", { name: /^classify$/i }).click();
  await expect(page.getByText(HS_CODE)).toBeVisible();
});

test("photo ResultCard shows 'partially compliant' banner when flagged", async ({ page }) => {
  await page.getByRole("button", { name: /^photo$/i }).click();
  await page.setInputFiles('input[type="file"]', FIXTURE_JPEG);
  await page.getByRole("button", { name: /^classify$/i }).click();
  await expect(page.getByText(/partially compliant/i)).toBeVisible();
});

test("photo ResultCard shows LOW_CONFIDENCE warning text", async ({ page }) => {
  await page.getByRole("button", { name: /^photo$/i }).click();
  await page.setInputFiles('input[type="file"]', FIXTURE_JPEG);
  await page.getByRole("button", { name: /^classify$/i }).click();
  await expect(page.getByText(/confidence below 80/i)).toBeVisible();
});

test("photo ResultCard shows confidence badge", async ({ page }) => {
  await page.getByRole("button", { name: /^photo$/i }).click();
  await page.setInputFiles('input[type="file"]', FIXTURE_JPEG);
  await page.getByRole("button", { name: /^classify$/i }).click();
  await expect(
    page.getByText(`${GOLDEN_PHOTO.data.ai_metadata.confidence_score}% confidence`)
  ).toBeVisible();
});

test("photo ResultCard shows product image when image_url is set", async ({ page }) => {
  await page.getByRole("button", { name: /^photo$/i }).click();
  await page.setInputFiles('input[type="file"]', FIXTURE_JPEG);
  await page.getByRole("button", { name: /^classify$/i }).click();
  const img = page.locator("img[alt='Evaluated product']");
  await expect(img).toBeVisible();
  await expect(img).toHaveAttribute("src", GOLDEN_PHOTO.data.image_url!);
});

test("'Classify another' after photo resets to Photo tab", async ({ page }) => {
  await page.getByRole("button", { name: /^photo$/i }).click();
  await page.setInputFiles('input[type="file"]', FIXTURE_JPEG);
  await page.getByRole("button", { name: /^classify$/i }).click();
  await page.getByRole("button", { name: /classify another/i }).click();
  await expect(page.getByText("Take or Choose Photo")).toBeVisible();
  await expect(page.getByText(HS_CODE)).not.toBeVisible();
});
