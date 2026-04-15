export default function AccountPage() {
  return (
    <main className="max-w-2xl mx-auto px-6 pt-4 pb-10">
      <header className="mb-10">
        <p className="text-[0.6875rem] font-bold uppercase tracking-widest text-accent">
          Flow · Workspace
        </p>
        <h1 className="font-serif italic text-[2.25rem] leading-[1.1] mt-3 text-primary">
          Workspace
        </h1>
      </header>

      {/* Profile card */}
      <section className="bg-surface-lowest rounded-3xl p-8 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-secondary text-on-secondary flex items-center justify-center">
            <span className="font-serif italic text-2xl">A</span>
          </div>
          <div>
            <p className="font-sans text-lg font-medium text-primary">
              Acme Trading Co.
            </p>
            <p className="text-xs text-primary/50 mt-0.5">
              Seller · joined April 2026
            </p>
          </div>
        </div>
      </section>

      {/* API key card */}
      <section className="bg-surface-lowest rounded-3xl p-8 mb-6">
        <p className="text-[0.6875rem] font-bold uppercase tracking-widest text-primary/50">
          API Key
        </p>
        <div className="mt-4 flex items-center gap-3 bg-surface-container rounded-2xl px-4 py-3">
          <span className="font-mono text-sm text-primary flex-1 truncate">
            sk_flow_••••••••7821
          </span>
          <button className="text-[0.6875rem] font-bold uppercase tracking-widest text-accent">
            Reveal
          </button>
        </div>
        <div className="mt-4 flex gap-3">
          <button className="text-xs font-sans text-primary/60 hover:text-accent transition">
            Rotate key
          </button>
          <span className="text-primary/20">·</span>
          <button className="text-xs font-sans text-primary/60 hover:text-accent transition">
            Copy
          </button>
        </div>
      </section>

      {/* Usage card */}
      <section className="bg-surface-lowest rounded-3xl p-8 mb-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[0.6875rem] font-bold uppercase tracking-widest text-primary/50">
            Classifications this month
          </p>
          <p className="font-serif italic text-xl text-primary">
            1,284 <span className="text-primary/40">/ 5,000</span>
          </p>
        </div>
        <div className="h-2 bg-surface-container rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full"
            style={{ width: "25.68%" }}
          />
        </div>
        <p className="text-xs text-primary/50 mt-3">
          Resets on the 1st of next month.
        </p>
      </section>

      {/* Plan card */}
      <section className="bg-primary rounded-3xl p-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[0.6875rem] font-bold uppercase tracking-widest text-white/60">
              Plan
            </p>
            <p className="font-serif italic text-3xl mt-2">Growth</p>
            <p className="text-sm text-white/70 mt-2">
              5,000 classifications/mo · 2-way sync · signed webhooks
            </p>
          </div>
          <span className="material-symbols-outlined text-4xl text-accent">
            auto_awesome
          </span>
        </div>
        <button className="mt-6 bg-secondary text-on-secondary px-6 py-2.5 rounded-full text-xs font-bold uppercase tracking-widest hover:brightness-105 transition">
          Upgrade to Scale
        </button>
      </section>
    </main>
  );
}
