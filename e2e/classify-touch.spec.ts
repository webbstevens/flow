/**
 * E2E: Touch / mobile interface tests.
 *
 * Runs via the `mobile-android` and `mobile-ios` projects defined in
 * playwright.config.ts (Pixel 5 + iPhone 12 emulation).  Device viewport and
 * user-agent are set by the project config — this file adds no test.use overrides.
 *
 * On desktop this spec is skipped automatically (viewport wider than 768 px).
 */

import path from "node:path";
import { test, expect } from "@playwright/test";
import { mockClassifyApi } from "./helpers/mock-classify";
import { GOLDEN_PHOTO } from "./fixtures/golden";

const FIXTURE_JPEG = path.join(__dirname, "fixtures", "test-product.jpg");

// Skip on desktop projects where viewport.width >= 768.
test.beforeEach(async ({ page, viewport }) => {
  if ((viewport?.width ?? 1280) >= 768) {
    test.skip();
    return;
  }
  await mockClassifyApi(page, "photo");
  await page.goto("/classify");
  // Give the useEffect device-detection a tick to settle.
  await page.waitForTimeout(150);
});

// ─── default mode ─────────────────────────────────────────────────────────────

test("Photo tab is active by default on mobile", async ({ page }) => {
  const photoBtn = page.getByRole("button", { name: /^photo$/i });
  await expect(photoBtn).toHaveClass(/bg-primary/);
});

test("URL tab is NOT active by default on mobile", async ({ page }) => {
  const urlBtn = page.getByRole("button", { name: /^url$/i });
  await expect(urlBtn).not.toHaveClass(/bg-primary/);
});

test("URL input is not visible on initial mobile load", async ({ page }) => {
  await expect(page.getByPlaceholder(/https:\/\/www\.example\.com/)).not.toBeVisible();
});

test("'Take or Choose Photo' button is visible on initial mobile load", async ({ page }) => {
  await expect(page.getByText("Take or Choose Photo")).toBeVisible();
});

// ─── mode switching via tap ───────────────────────────────────────────────────

test("tapping URL tab switches to URL mode", async ({ page }) => {
  await page.getByRole("button", { name: /^url$/i }).tap();
  await expect(page.getByPlaceholder(/https:\/\/www\.example\.com/)).toBeVisible();
  await expect(page.getByRole("button", { name: /^url$/i })).toHaveClass(/bg-primary/);
});

test("tapping Photo tab from URL mode switches back", async ({ page }) => {
  await page.getByRole("button", { name: /^url$/i }).tap();
  await page.getByRole("button", { name: /^photo$/i }).tap();
  await expect(page.getByText("Take or Choose Photo")).toBeVisible();
  await expect(page.getByPlaceholder(/https:\/\/www\.example\.com/)).not.toBeVisible();
});

// ─── photo upload + classify ──────────────────────────────────────────────────

test("uploading a photo on mobile shows image preview", async ({ page }) => {
  await page.setInputFiles('input[type="file"]', FIXTURE_JPEG);
  await expect(page.locator("img[alt='Captured product']")).toBeVisible();
});

test("classifying a photo on mobile shows ResultCard with HS code", async ({ page }) => {
  await page.setInputFiles('input[type="file"]', FIXTURE_JPEG);
  await page.getByRole("button", { name: /^classify$/i }).tap();
  await expect(page.getByText(GOLDEN_PHOTO.data.classification.hs_code)).toBeVisible();
});

// ─── navigation chrome ────────────────────────────────────────────────────────

test("bottom nav Classify tab is highlighted on /classify", async ({ page }) => {
  // Scope to the bottom nav specifically (fixed bottom-0, md:hidden)
  const bottomNav = page.locator("nav.fixed.bottom-0");
  const classifyLink = bottomNav.locator("a[href='/classify']");
  await expect(classifyLink).toHaveClass(/bg-secondary/);
});

test("desktop top nav links are hidden at mobile width", async ({ page }) => {
  // TopNav wraps the links in a <nav class="hidden md:flex ...">
  // At mobile width the md: breakpoint doesn't activate, so it stays hidden.
  const desktopNav = page.locator("header nav.hidden");
  await expect(desktopNav).not.toBeVisible();
});
