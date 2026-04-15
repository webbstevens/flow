import Link from "next/link";

export default function Home() {
  return (
    <main className="max-w-7xl mx-auto px-6 pt-4 pb-20">
      {/* Hero */}
      <section className="mt-8 md:mt-12 mb-16 md:mb-24 max-w-4xl">
        <h1
          className="font-serif italic text-primary leading-[1.1] mb-6 text-[2.5rem] md:text-[3.5rem]"
          style={{ fontStyle: "italic" }}
        >
          Headless, API-First,
          <br />
          Developer-Ready.
        </h1>
        <p className="text-lg md:text-xl text-on-surface-variant max-w-2xl leading-relaxed">
          We believe global trade logic should be invisible. Flow provides the
          clean infrastructure layers needed to automate catalog
          normalization, logistics webhooks, and 2-way platform
          synchronization.
        </p>
        <div className="mt-10 flex flex-wrap gap-4">
          <Link
            href="/classify"
            className="bg-primary text-white px-8 py-3 rounded-full text-xs font-bold uppercase tracking-widest flex items-center gap-2 hover:opacity-90 transition"
          >
            Start Building
            <span className="material-symbols-outlined text-base">
              arrow_forward
            </span>
          </Link>
          <Link
            href="/docs"
            className="bg-secondary text-on-secondary px-8 py-3 rounded-full text-xs font-bold uppercase tracking-widest hover:opacity-90 transition"
          >
            Docs
          </Link>
        </div>
      </section>

      {/* Bento grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Code snippet card */}
        <div className="md:col-span-7 bg-surface-lowest rounded-2xl p-8 overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-serif italic text-lg font-bold text-primary mb-1">
                Normalized Catalog Item
              </h3>
              <p className="text-sm text-on-surface-variant">
                Clean JSON response for any SKU across all trade routes.
              </p>
            </div>
            <div className="flex gap-2">
              <div className="w-3 h-3 rounded-full bg-red-400/20" />
              <div className="w-3 h-3 rounded-full bg-yellow-400/20" />
              <div className="w-3 h-3 rounded-full bg-green-400/20" />
            </div>
          </div>
          <div className="bg-[#0d1117] rounded-xl p-6 font-mono text-sm overflow-x-auto">
            <pre className="text-gray-300">
              <span className="text-purple-400">{"{"}</span>
              {"\n  "}
              <span className="text-green-400">&quot;object&quot;</span>
              {": "}
              <span className="text-yellow-200">&quot;catalog_item&quot;</span>
              {",\n  "}
              <span className="text-green-400">&quot;id&quot;</span>
              {": "}
              <span className="text-yellow-200">&quot;sku_9821_flow&quot;</span>
              {",\n  "}
              <span className="text-green-400">
                &quot;normalization_status&quot;
              </span>
              {": "}
              <span className="text-yellow-200">&quot;verified&quot;</span>
              {",\n  "}
              <span className="text-green-400">&quot;attributes&quot;</span>
              {": "}
              <span className="text-purple-400">{"{"}</span>
              {"\n    "}
              <span className="text-green-400">&quot;hs_code&quot;</span>
              {": "}
              <span className="text-yellow-200">&quot;6109.10&quot;</span>
              {",\n    "}
              <span className="text-green-400">&quot;origin&quot;</span>
              {": "}
              <span className="text-yellow-200">&quot;PT&quot;</span>
              {",\n    "}
              <span className="text-green-400">&quot;weight_grams&quot;</span>
              {": "}
              <span className="text-purple-300">240</span>
              {",\n    "}
              <span className="text-green-400">&quot;material&quot;</span>
              {": "}
              <span className="text-yellow-200">
                &quot;organic_cotton&quot;
              </span>
              {"\n  "}
              <span className="text-purple-400">{"}"}</span>
              {"\n"}
              <span className="text-purple-400">{"}"}</span>
            </pre>
          </div>
        </div>

        {/* Webhook visualization card */}
        <div className="md:col-span-5 bg-surface-container text-primary rounded-2xl p-8 flex flex-col justify-between min-h-[340px]">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-accent mb-4 block">
              Infrastructure
            </span>
            <h3 className="font-serif italic text-2xl mb-4">
              2-Way Platform Sync
            </h3>
            <p className="text-on-surface-variant leading-relaxed text-sm">
              Real-time state synchronization using signed Webhooks. When an
              inventory level shifts in one region, Flow propagates the update
              to your entire headless ecosystem in milliseconds.
            </p>
          </div>
          <div className="mt-8 relative h-20 flex items-center justify-center">
            <div className="absolute left-0 w-12 h-12 bg-surface-lowest rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined text-primary">
                cloud_sync
              </span>
            </div>
            <div className="flex-1 h-[2px] mx-16 bg-surface-container-high relative overflow-hidden rounded-full">
              <div className="flow-indicator h-full w-full" />
            </div>
            <div className="absolute right-0 w-12 h-12 bg-surface-lowest rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined text-primary">
                terminal
              </span>
            </div>
          </div>
          <div className="mt-6 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest opacity-60">
            <span>Platform</span>
            <span>Flow Engine</span>
            <span>Endpoint</span>
          </div>
        </div>

        {/* Feature Card 1 */}
        <FeatureCard
          icon="security"
          title="Signed Payloads"
          body="Verify the authenticity of every webhook event with HMAC signatures, ensuring zero compromise on trade data integrity."
          tint="green"
        />
        <FeatureCard
          icon="history"
          title="Event Replay"
          body="Missed a sync? Replay any trade event from the last 30 days directly through the dashboard or via API calls."
          tint="neutral"
        />
        <FeatureCard
          icon="code_blocks"
          title="SDK Ecosystem"
          body="Native wrappers for TypeScript, Python, and Go. Typed interfaces for every trade jurisdiction worldwide."
          tint="neutral"
        />
      </div>

      {/* Dark CTA */}
      <section
        id="docs"
        className="mt-16 md:mt-24 p-8 md:p-12 bg-primary rounded-2xl text-white flex flex-col md:flex-row items-center justify-between gap-10 overflow-hidden relative"
      >
        <div className="max-w-xl z-10">
          <h2 className="font-serif italic text-3xl md:text-4xl text-white mb-6 leading-tight">
            Reduce complexity to a single response.
          </h2>
          <p className="text-white/70 text-base md:text-lg leading-relaxed mb-8">
            Stop managing separate logic for each market. Flow normalizes the
            world&apos;s commerce data so you can focus on building the
            experience.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link
              href="/docs"
              className="bg-secondary text-on-secondary px-8 py-3 rounded-full text-xs font-bold uppercase tracking-widest hover:brightness-105 transition-all"
            >
              View API Reference
            </Link>
            <a
              href="#"
              className="text-white border border-white/30 px-8 py-3 rounded-full text-xs font-bold uppercase tracking-widest hover:bg-white/5 transition-all"
            >
              Talk to an Architect
            </a>
          </div>
        </div>
        <div className="z-10 w-full md:w-auto">
          <div className="bg-white/5 backdrop-blur-md p-6 rounded-2xl border border-white/10 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-2 h-2 rounded-full bg-green-400" />
              <span className="text-xs font-mono text-white/80">
                POST /v1/synchronize
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-1 w-24 bg-white/20 rounded-full" />
              <div className="h-1 w-12 bg-accent rounded-full" />
              <div className="h-1 w-8 bg-white/20 rounded-full" />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function FeatureCard({
  icon,
  title,
  body,
  tint,
}: {
  icon: string;
  title: string;
  body: string;
  tint: "green" | "neutral";
}) {
  return (
    <div className="md:col-span-4 bg-surface-lowest rounded-2xl p-8">
      <div
        className={`w-12 h-12 rounded-full flex items-center justify-center mb-6 ${
          tint === "green"
            ? "bg-secondary text-on-secondary"
            : "bg-surface-container text-primary"
        }`}
      >
        <span className="material-symbols-outlined">{icon}</span>
      </div>
      <h4 className="font-sans text-lg font-bold text-primary mb-2">
        {title}
      </h4>
      <p className="text-sm text-on-surface-variant leading-relaxed">{body}</p>
    </div>
  );
}
