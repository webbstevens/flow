import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, getWorkspaceId } from "@/lib/session";
import { publicUrlForPath } from "@/lib/image-storage";
import { deriveCompliance } from "@/lib/compliance";
import { ComplianceBadge } from "../_components/ComplianceBadge";
import {
  ComplianceCard,
  ComplianceRow,
} from "../_components/ComplianceCard";

type Tab = "overview" | "attributes" | "raw";

export default async function AnalyticsDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const workspaceId = await getWorkspaceId();
  if (!workspaceId) redirect("/account/init");

  const { id } = await params;
  const { tab: tabParam } = await searchParams;
  const tab: Tab =
    tabParam === "attributes" || tabParam === "raw" ? tabParam : "overview";

  const record = await prisma.classificationRecord.findUnique({
    where: { id },
  });

  if (!record || record.workspaceId !== workspaceId) {
    notFound();
  }

  const imageUrl = publicUrlForPath(record.imageStoragePath);
  const attributes =
    record.aiAttributes && typeof record.aiAttributes === "object"
      ? (record.aiAttributes as Record<string, unknown>)
      : {};
  const evaluation = deriveCompliance({
    hsCode: record.hsCode,
    countryOfOrigin: record.countryOfOrigin,
    confidenceScore: record.confidenceScore,
    requiresReview: record.requiresReview,
    restrictedGoodsFlag: record.restrictedGoodsFlag,
  });
  const isPartial = evaluation.status === "partially_compliant";

  const overallStatus: {
    label: string;
    tint: "green" | "amber" | "red" | "neutral";
  } = record.restrictedGoodsFlag
    ? { label: "Restricted", tint: "red" }
    : record.requiresReview
      ? { label: "Needs review", tint: "amber" }
      : record.confidenceScore >= 90
        ? { label: "Verified", tint: "green" }
        : { label: "OK", tint: "neutral" };

  return (
    <main className="max-w-6xl mx-auto px-6 pt-4 pb-10">
      <Link
        href="/analytics"
        className="inline-flex items-center gap-1 font-sans text-xs font-bold uppercase tracking-widest text-primary/60 hover:text-accent transition mb-6"
      >
        <span className="material-symbols-outlined text-sm">arrow_back</span>
        Back to analytics
      </Link>

      {isPartial && (
        <div className="bg-amber-100 text-amber-900 rounded-2xl px-5 py-4 mb-6">
          <p className="font-sans text-[0.6875rem] font-bold uppercase tracking-widest mb-2">
            Partially compliant — action required
          </p>
          {evaluation.missing_required_fields.length > 0 && (
            <p className="font-sans text-sm">
              Missing required field
              {evaluation.missing_required_fields.length > 1 ? "s" : ""}:{" "}
              <span className="font-mono">
                {evaluation.missing_required_fields.join(", ")}
              </span>
              . Fill in via{" "}
              <span className="font-mono">PATCH /products/:id</span> before
              generating customs documents.
            </p>
          )}
          {evaluation.warnings.map((w) => (
            <p key={w.code} className="font-sans text-sm mt-1">
              {w.message}
            </p>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* Main column */}
        <div>
          {/* Hero image */}
          <div className="bg-surface-lowest rounded-3xl overflow-hidden aspect-[16/10] mb-6">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="material-symbols-outlined text-primary/20 text-5xl">
                  image
                </span>
              </div>
            )}
          </div>

          {/* Header block */}
          <header className="mb-8">
            <p className="font-sans text-[0.6875rem] font-bold uppercase tracking-widest text-accent">
              Classification record
            </p>
            <h1 className="font-serif italic text-[2.25rem] leading-[1.1] mt-3 text-primary">
              {record.sourceTitle ?? "Untitled product"}
            </h1>
            <div className="flex flex-wrap items-center gap-3 mt-4">
              <span className="font-mono text-lg text-primary">
                {record.hsCode}
              </span>
              {record.countryOfOrigin && (
                <span className="font-sans text-sm text-primary/60">
                  · {record.countryOfOrigin}
                </span>
              )}
              {record.materials && (
                <span className="font-sans text-sm text-primary/60 truncate">
                  · {record.materials}
                </span>
              )}
            </div>
          </header>

          {/* Tabs */}
          <nav className="flex gap-1 mb-6 border-b border-surface-container">
            <TabLink id={record.id} tab="overview" current={tab} label="Overview" />
            <TabLink
              id={record.id}
              tab="attributes"
              current={tab}
              label="Attributes"
            />
            <TabLink id={record.id} tab="raw" current={tab} label="Raw" />
          </nav>

          {/* Tab content */}
          {tab === "overview" && (
            <section className="space-y-6">
              {record.customsDescription && (
                <div className="bg-surface-lowest rounded-2xl p-6">
                  <p className="font-sans text-[0.6875rem] font-bold uppercase tracking-widest text-primary/50 mb-3">
                    Customs description
                  </p>
                  <p className="font-serif italic text-lg text-primary leading-snug">
                    &ldquo;{record.customsDescription}&rdquo;
                  </p>
                </div>
              )}

              <div className="bg-surface-lowest rounded-2xl p-6">
                <p className="font-sans text-[0.6875rem] font-bold uppercase tracking-widest text-primary/50 mb-4">
                  Product information
                </p>
                <dl className="space-y-3">
                  {record.sourceTitle && (
                    <ComplianceRow
                      label="Title"
                      value={record.sourceTitle}
                    />
                  )}
                  {record.productUrl && (
                    <ComplianceRow
                      label="Source URL"
                      value={
                        <a
                          href={record.productUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-accent hover:underline break-all"
                        >
                          {record.productUrl}
                        </a>
                      }
                    />
                  )}
                  {record.materials && (
                    <ComplianceRow label="Materials" value={record.materials} />
                  )}
                  {record.countryOfOrigin && (
                    <ComplianceRow
                      label="Country of origin"
                      value={record.countryOfOrigin}
                    />
                  )}
                </dl>
              </div>
            </section>
          )}

          {tab === "attributes" && (
            <section className="bg-surface-lowest rounded-2xl p-6">
              <p className="font-sans text-[0.6875rem] font-bold uppercase tracking-widest text-primary/50 mb-4">
                AI-extracted attributes
              </p>
              {Object.keys(attributes).length === 0 ? (
                <p className="font-sans text-sm text-primary/60">
                  No attributes captured for this evaluation.
                </p>
              ) : (
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {Object.entries(attributes).map(([key, value]) => (
                    <div
                      key={key}
                      className="bg-surface-container rounded-xl px-4 py-3"
                    >
                      <dt className="font-sans text-[0.6875rem] font-bold uppercase tracking-widest text-primary/50">
                        {key.replace(/_/g, " ")}
                      </dt>
                      <dd className="font-sans text-sm text-primary mt-1 break-words">
                        {formatAttributeValue(value)}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </section>
          )}

          {tab === "raw" && (
            <section className="bg-surface-lowest rounded-2xl p-6">
              <p className="font-sans text-[0.6875rem] font-bold uppercase tracking-widest text-primary/50 mb-4">
                Raw record
              </p>
              <pre className="font-mono text-xs text-primary/80 bg-surface-container rounded-xl p-4 overflow-x-auto">
                {JSON.stringify(
                  {
                    id: record.id,
                    hs_code: record.hsCode,
                    mid_code: record.midCode,
                    confidence_score: record.confidenceScore,
                    requires_review: record.requiresReview,
                    restricted_goods_flag: record.restrictedGoodsFlag,
                    country_of_origin: record.countryOfOrigin,
                    materials: record.materials,
                    customs_description: record.customsDescription,
                    source_title: record.sourceTitle,
                    product_url: record.productUrl,
                    ai_attributes: attributes,
                    created_at: record.createdAt.toISOString(),
                  },
                  null,
                  2,
                )}
              </pre>
            </section>
          )}
        </div>

        {/* Sidebar */}
        <aside className="space-y-4">
          <ComplianceCard title="Compliance status" status={overallStatus}>
            <ComplianceRow
              label="Confidence"
              value={
                <ComplianceBadge
                  kind="confidence"
                  confidence={record.confidenceScore}
                />
              }
            />
            <ComplianceRow
              label="Requires review"
              value={record.requiresReview ? "Yes" : "No"}
            />
            <ComplianceRow
              label="Restricted goods"
              value={record.restrictedGoodsFlag ? "Yes" : "No"}
            />
          </ComplianceCard>

          <ComplianceCard title="Cross-border">
            <ComplianceRow
              label="HS code"
              value={<span className="font-mono">{record.hsCode}</span>}
            />
            {record.midCode && (
              <ComplianceRow
                label="MID code"
                value={<span className="font-mono">{record.midCode}</span>}
              />
            )}
            <ComplianceRow
              label="Country of origin"
              value={record.countryOfOrigin ?? "—"}
            />
          </ComplianceCard>

          <ComplianceCard title="Source">
            <ComplianceRow
              label="Type"
              value={record.productUrl ? "URL" : "Upload"}
            />
            <ComplianceRow
              label="Evaluated"
              value={formatDateTime(record.createdAt)}
            />
          </ComplianceCard>
        </aside>
      </div>
    </main>
  );
}

function TabLink({
  id,
  tab,
  current,
  label,
}: {
  id: string;
  tab: Tab;
  current: Tab;
  label: string;
}) {
  const active = tab === current;
  return (
    <Link
      href={`/analytics/${id}${tab === "overview" ? "" : `?tab=${tab}`}`}
      className={`font-sans text-xs font-bold uppercase tracking-widest px-4 py-3 -mb-px border-b-2 transition ${
        active
          ? "border-accent text-primary"
          : "border-transparent text-primary/50 hover:text-primary"
      }`}
    >
      {label}
    </Link>
  );
}

function formatAttributeValue(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

function formatDateTime(d: Date): string {
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
