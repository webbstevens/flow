/**
 * E2E: URL classification flow — desktop viewport.
 *
 * All classify + history API calls are intercepted with golden fixtures so
 * no real Anthropic / DB connection is required.
 */

import { test, expect } from "@playwright/test";
import { mockClassifyApi } from "./helpers/mock-classify";
import { GOLDEN_URL } from "./fixtures/golden";

const HS_CODE = GOLDEN_URL.data.classification.hs_code; // "6109.10.0012"
const CONFIDENCE = GOLDEN_URL.data.ai_metadata.confidence_score; // 92

test.use({ viewport: { width: 1280, height: 800 } });

test.beforeEach(async ({ page }) => {
  await mockClassifyApi(page, "url");
  await page.goto("/classify");
});

// ─── initial render ────────────────────────────────────────────────────────────

test("URL tab is active by default on desktop", async ({ page }) => {
  const urlBtn = page.getByRole("button", { name: /^url$/i });
  await expect(urlBtn).toHaveClass(/bg-primary/);
  await expect(page.getByPlaceholder(/https:\/\/www\.example\.com/)).toBeVisible();
});

test("Photo tab is NOT active by default on desktop", async ({ page }) => {
  const photoBtn = page.getByRole("button", { name: /^photo$/i });
  await expect(photoBtn).not.toHaveClass(/bg-primary/);
  await expect(page.getByText("Take or Choose Photo")).not.toBeVisible();
});

// ─── input interaction ─────────────────────────────────────────────────────────

test("typing a URL into the input shows it", async ({ page }) => {
  const input = page.getByPlaceholder(/https:\/\/www\.example\.com/);
  await input.fill("https://www.ebay.co.uk/itm/365500972148");
  await expect(input).toHaveValue("https://www.ebay.co.uk/itm/365500972148");
});

test("Classify button is disabled when input is empty", async ({ page }) => {
  await expect(page.getByRole("button", { name: /^classify$/i })).toBeDisabled();
});

test("Classify button enables after typing a URL", async ({ page }) => {
  await page.getByPlaceholder(/https:\/\/www\.example\.com/).fill("https://example.com/p");
  await expect(page.getByRole("button", { name: /^classify$/i })).toBeEnabled();
});

// ─── classify flow ─────────────────────────────────────────────────────────────

test("pressing Enter submits the classify request", async ({ page }) => {
  await page.getByPlaceholder(/https:\/\/www\.example\.com/).fill("https://example.com/p");
  await page.keyboard.press("Enter");
  await expect(page.getByText(HS_CODE)).toBeVisible();
});

test("clicking Classify shows ResultCard with golden HS code", async ({ page }) => {
  await page.getByPlaceholder(/https:\/\/www\.example\.com/).fill("https://www.ebay.co.uk/itm/365500972148");
  await page.getByRole("button", { name: /^classify$/i }).click();
  await expect(page.getByText(HS_CODE)).toBeVisible();
});

test("ResultCard shows confidence badge with correct score", async ({ page }) => {
  await page.getByPlaceholder(/https:\/\/www\.example\.com/).fill("https://example.com/p");
  await page.getByRole("button", { name: /^classify$/i }).click();
  await expect(page.getByText(`${CONFIDENCE}% confidence`)).toBeVisible();
});

test("ResultCard shows compliance details (COO, materials, description)", async ({ page }) => {
  await page.getByPlaceholder(/https:\/\/www\.example\.com/).fill("https://example.com/p");
  await page.getByRole("button", { name: /^classify$/i }).click();
  await expect(page.getByText(GOLDEN_URL.data.classification.coo!, { exact: true })).toBeVisible();
  await expect(page.getByText(GOLDEN_URL.data.classification.materials!, { exact: true })).toBeVisible();
});

test("'Classify another' button resets to input state", async ({ page }) => {
  await page.getByPlaceholder(/https:\/\/www\.example\.com/).fill("https://example.com/p");
  await page.getByRole("button", { name: /^classify$/i }).click();
  await page.getByRole("button", { name: /classify another/i }).click();
  await expect(page.getByPlaceholder(/https:\/\/www\.example\.com/)).toBeVisible();
  await expect(page.getByText(HS_CODE)).not.toBeVisible();
});

// ─── error states ──────────────────────────────────────────────────────────────

test("403-blocked error shows red Error label", async ({ page }) => {
  await mockClassifyApi(page, "blocked");
  await page.getByPlaceholder(/https:\/\/www\.example\.com/).fill("https://www.ebay.co.uk/itm/1");
  await page.getByRole("button", { name: /^classify$/i }).click();
  await expect(page.getByText(/error/i).first()).toBeVisible();
});

test("403-blocked error shows 'Switch to Photo mode' shortcut", async ({ page }) => {
  await mockClassifyApi(page, "blocked");
  await page.getByPlaceholder(/https:\/\/www\.example\.com/).fill("https://www.ebay.co.uk/itm/1");
  await page.getByRole("button", { name: /^classify$/i }).click();
  await expect(page.getByRole("button", { name: /switch to photo mode/i })).toBeVisible();
});

test("clicking 'Switch to Photo mode' activates Photo tab and clears error", async ({ page }) => {
  await mockClassifyApi(page, "blocked");
  await page.getByPlaceholder(/https:\/\/www\.example\.com/).fill("https://www.ebay.co.uk/itm/1");
  await page.getByRole("button", { name: /^classify$/i }).click();
  await page.getByRole("button", { name: /switch to photo mode/i }).click();
  const photoBtn = page.getByRole("button", { name: /^photo$/i });
  await expect(photoBtn).toHaveClass(/bg-primary/);
  await expect(page.getByRole("button", { name: /switch to photo mode/i })).not.toBeVisible();
});

test("500 server error shows error section without Switch shortcut", async ({ page }) => {
  await mockClassifyApi(page, "server-error");
  await page.getByPlaceholder(/https:\/\/www\.example\.com/).fill("https://example.com/p");
  await page.getByRole("button", { name: /^classify$/i }).click();
  await expect(page.getByText(/error/i).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /switch to photo mode/i })).not.toBeVisible();
});
