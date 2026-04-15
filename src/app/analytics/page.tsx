export default function AnalyticsPage() {
  return (
    <main className="max-w-4xl mx-auto px-6 pt-4 pb-10">
      <header className="mb-10">
        <p className="text-[0.6875rem] font-bold uppercase tracking-widest text-accent">
          Flow · Intelligence
        </p>
        <h1 className="font-serif italic text-[2.25rem] leading-[1.1] mt-3 text-primary">
          Catalog Intelligence
        </h1>
        <p className="text-sm text-on-surface-variant mt-4 max-w-lg">
          Classification activity across your workspace this week.
        </p>
      </header>

      {/* Hero stat */}
      <section className="bg-surface-lowest rounded-3xl p-8 md:p-10 mb-6">
        <p className="text-[0.6875rem] font-bold uppercase tracking-widest text-primary/50">
          Classifications · last 7 days
        </p>
        <p className="font-serif italic text-[4rem] md:text-[5.5rem] leading-none mt-4 text-primary tracking-tight">
          1,284
        </p>
        <div className="mt-6 h-[2px] rounded-full overflow-hidden bg-surface-container">
          <div className="flow-indicator h-full w-full" />
        </div>
        <p className="text-xs text-primary/50 mt-3 font-sans">
          Live · processing
        </p>
      </section>

      {/* Secondary metrics */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          label="Avg confidence"
          value="89%"
          sub="across all classifications"
          tint="green"
        />
        <MetricCard
          label="Needs review"
          value="12"
          sub="confidence below 70"
          tint="amber"
        />
        <MetricCard
          label="Top HS chapter"
          value="61"
          sub="Apparel, knit or crocheted"
          tint="neutral"
        />
      </section>

      {/* Top codes */}
      <section className="mt-6 bg-surface-lowest rounded-3xl p-8">
        <p className="text-[0.6875rem] font-bold uppercase tracking-widest text-primary/50 mb-6">
          Top HS codes this week
        </p>
        <ul className="space-y-4">
          {TOP_CODES.map((row, i) => (
            <li key={i} className="flex items-center gap-4">
              <span className="font-serif italic text-xl text-primary w-24">
                {row.code}
              </span>
              <span className="text-sm text-primary/70 flex-1">
                {row.label}
              </span>
              <div className="w-40 h-[6px] bg-surface-container rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full"
                  style={{ width: `${row.pct}%` }}
                />
              </div>
              <span className="text-xs text-primary/50 w-12 text-right">
                {row.count}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function MetricCard({
  label,
  value,
  sub,
  tint,
}: {
  label: string;
  value: string;
  sub: string;
  tint: "green" | "amber" | "neutral";
}) {
  const accent =
    tint === "green"
      ? "text-on-secondary"
      : tint === "amber"
        ? "text-amber-900"
        : "text-primary";
  return (
    <div className="bg-surface-lowest rounded-3xl p-6">
      <p className="text-[0.6875rem] font-bold uppercase tracking-widest text-primary/50">
        {label}
      </p>
      <p className={`font-serif italic text-4xl mt-2 ${accent}`}>{value}</p>
      <p className="text-xs text-primary/50 mt-2">{sub}</p>
    </div>
  );
}

const TOP_CODES = [
  { code: "6109.10", label: "T-shirts, knit cotton", pct: 100, count: 342 },
  { code: "8518.30", label: "Headphones", pct: 62, count: 214 },
  { code: "4202.21", label: "Leather handbags", pct: 41, count: 141 },
  { code: "1509.20", label: "Olive oil, extra virgin", pct: 28, count: 96 },
  { code: "6403.99", label: "Footwear, leather upper", pct: 19, count: 66 },
];
