/**
 * Real-Postgres integration test for the classify persistence path.
 *
 * This exercises `prisma.classificationRecord.create` — the exact blocking
 * write at src/app/api/v1/compliance/classify/route.ts that silently broke in
 * production when the database went away. The Playwright E2E suite mocks
 * /api/v1/compliance/classify (e2e/helpers/mock-classify.ts), so the real DB
 * path is never executed there; this is the regression guard for it.
 *
 * Skipped unless RUN_DB_TESTS=1 (the `integration` workflow sets it against a
 * live Postgres service). Locally it stays skipped so `npm test` needs no DB.
 */
import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";

const enabled = process.env.RUN_DB_TESTS === "1";

describe.skipIf(!enabled)("DB integration (real Postgres)", () => {
  it("connects to the database", async () => {
    const rows = await prisma.$queryRaw`SELECT 1 as ok`;
    expect(rows).toBeTruthy();
  });

  it("persists and reads back a ClassificationRecord", async () => {
    const created = await prisma.classificationRecord.create({
      data: {
        workspaceId: null,
        hsCode: "6109.10.0012",
        confidenceScore: 87,
        requiresReview: false,
        restrictedGoodsFlag: false,
        destinationCountry: "US",
        materials: "100% cotton",
      },
    });
    expect(created.id).toBeTruthy();

    const found = await prisma.classificationRecord.findUnique({
      where: { id: created.id },
    });
    expect(found?.hsCode).toBe("6109.10.0012");

    // Keep the test DB clean for reruns.
    await prisma.classificationRecord.delete({ where: { id: created.id } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });
});
