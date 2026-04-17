import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, getWorkspaceId } from "@/lib/session";
import { publicUrlForPath } from "@/lib/image-storage";
import { MetricCard } from "./_components/MetricCard";
import { RecordsTable, type RecordRow } from "./_components/RecordsTable";

export default async function AnalyticsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const workspaceId = await getWorkspaceId();
  if (!workspaceId) {
    redirect("/account/init");
  }

  const [records, total, needsReview, restricted, avgConfidence] =
    await Promise.all([
      prisma.classificationRecord.findMany({
        where: { workspaceId },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.classificationRecord.count({ where: { workspaceId } }),
      prisma.classificationRecord.count({
        where: { workspaceId, requiresReview: true },
      }),
      prisma.classificationRecord.count({
        where: { workspaceId, restrictedGoodsFlag: true },
      }),
      prisma.classificationRecord.aggregate({
        where: { workspaceId },
        _avg: { confidenceScore: true },
      }),
    ]);

  const rows: RecordRow[] = records.map((r) => ({
    id: r.id,
    imageUrl: publicUrlForPath(r.imageStoragePath),
    hsCode: r.hsCode,
    title: r.sourceTitle,
    productUrl: r.productUrl,
    confidenceScore: r.confidenceScore,
    requiresReview: r.requiresReview,
    restrictedGoodsFlag: r.restrictedGoodsFlag,
    countryOfOrigin: r.countryOfOrigin,
    createdAt: r.createdAt.toISOString(),
  }));

  const avg = avgConfidence._avg.confidenceScore;
  const avgDisplay = avg != null ? `${Math.round(avg)}%` : "—";

  return (
    <main className="max-w-6xl mx-auto px-6 pt-4 pb-10">
      <header className="mb-10">
        <p className="text-[0.6875rem] font-bold uppercase tracking-widest text-accent">
          Flow · Intelligence
        </p>
        <h1 className="font-serif italic text-[2.25rem] leading-[1.1] mt-3 text-primary">
          Catalog Intelligence
        </h1>
        <p className="text-sm text-on-surface-variant mt-4 max-w-lg">
          Every product you&apos;ve classified, with compliance status at a glance.
        </p>
      </header>

      {/* Metric cards */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <MetricCard
          label="Total classifications"
          value={total}
          sub={total === 0 ? "No evaluations yet" : "All-time"}
        />
        <MetricCard
          label="Needs review"
          value={needsReview}
          sub={needsReview > 0 ? "Low-confidence evaluations" : "All clear"}
          tint={needsReview > 0 ? "amber" : "neutral"}
        />
        <MetricCard
          label="Restricted goods"
          value={restricted}
          sub={restricted > 0 ? "Flagged for review" : "None flagged"}
          tint={restricted > 0 ? "red" : "neutral"}
        />
        <MetricCard
          label="Avg confidence"
          value={avgDisplay}
          sub="Across all records"
          tint={avg != null && avg >= 85 ? "green" : "neutral"}
        />
      </section>

      <RecordsTable rows={rows} />
    </main>
  );
}
