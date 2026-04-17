import { prisma } from "./prisma";

/**
 * Returns "2026-04" format for the current month.
 */
function currentMonth(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Increment a usage counter. Fire-and-forget.
 */
export function incrementUsage(workspaceId: string, endpoint: string) {
  const month = currentMonth();
  prisma.usageCounter
    .upsert({
      where: {
        workspaceId_month_endpoint: { workspaceId, month, endpoint },
      },
      create: { workspaceId, month, endpoint, count: 1 },
      update: { count: { increment: 1 } },
    })
    .catch((err) => {
      console.error("[usage] Failed to increment:", err.message);
    });
}

/**
 * Get usage summary for a workspace for the current month.
 * Returns a human-readable breakdown.
 */
export async function getMonthlyUsage(workspaceId: string) {
  const month = currentMonth();
  const counters = await prisma.usageCounter.findMany({
    where: { workspaceId, month },
    orderBy: { count: "desc" },
  });

  const total = counters.reduce((sum, c) => sum + c.count, 0);
  const breakdown: Record<string, number> = {};
  for (const c of counters) {
    breakdown[c.endpoint] = c.count;
  }

  return { month, total, breakdown };
}

/** Human-readable endpoint labels for display */
export const ENDPOINT_LABELS: Record<string, string> = {
  classify: "Classifications",
  "products.create": "Products created",
  "products.list": "Product listings",
  "products.update": "Product updates",
};

export function formatEndpoint(key: string): string {
  return ENDPOINT_LABELS[key] ?? key;
}
