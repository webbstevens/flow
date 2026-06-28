import { prisma } from "@/lib/prisma";

// Must reflect live state — never serve a cached health result.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DB_TIMEOUT_MS = 3000;

/**
 * Liveness + database readiness probe.
 *
 * Returns 200 only when the database is reachable, 503 otherwise. The classify
 * pipeline's blocking write (prisma.classificationRecord.create) fails silently
 * to end users when the DB goes away; this endpoint makes that failure loud and
 * machine-checkable for uptime monitors and the prod smoke workflow.
 */
export async function GET() {
  const startedAt = Date.now();
  const checks: Record<string, unknown> = {};
  let healthy = true;

  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error(`db check timed out after ${DB_TIMEOUT_MS}ms`)),
          DB_TIMEOUT_MS,
        ),
      ),
    ]);
    checks.db = "ok";
  } catch (err) {
    healthy = false;
    checks.db = "unreachable";
    checks.dbError = err instanceof Error ? err.message : String(err);
  }

  return Response.json(
    {
      status: healthy ? "ok" : "error",
      checks,
      latencyMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503 },
  );
}
