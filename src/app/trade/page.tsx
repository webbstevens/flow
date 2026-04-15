const ROUTES = [
  {
    from: "PT",
    fromLabel: "Portugal",
    to: "US",
    toLabel: "United States",
    product: "Organic cotton apparel",
    hsCode: "6109.10",
    status: "In transit",
    statusTone: "accent",
  },
  {
    from: "CN",
    fromLabel: "China",
    to: "DE",
    toLabel: "Germany",
    product: "Wireless headphones",
    hsCode: "8518.30",
    status: "Classified",
    statusTone: "green",
  },
  {
    from: "VN",
    fromLabel: "Vietnam",
    to: "CA",
    toLabel: "Canada",
    product: "Leather travel goods",
    hsCode: "4202.21",
    status: "Customs hold",
    statusTone: "amber",
  },
  {
    from: "IT",
    fromLabel: "Italy",
    to: "JP",
    toLabel: "Japan",
    product: "Extra virgin olive oil",
    hsCode: "1509.20",
    status: "Delivered",
    statusTone: "green",
  },
];

export default function TradePage() {
  return (
    <main className="max-w-4xl mx-auto px-6 pt-4 pb-10">
      <header className="mb-10">
        <p className="text-[0.6875rem] font-bold uppercase tracking-widest text-accent">
          Flow · Routes
        </p>
        <h1 className="font-serif italic text-[2.25rem] leading-[1.1] mt-3 text-primary">
          Live Trade Routes
        </h1>
        <p className="text-sm text-on-surface-variant mt-4 max-w-lg">
          Real-time state for every shipment moving through your marketplace.
        </p>
      </header>

      <div className="space-y-4">
        {ROUTES.map((route, i) => (
          <div
            key={i}
            className="bg-surface-lowest rounded-3xl p-6 md:p-8 flex flex-col md:flex-row md:items-center gap-4 md:gap-8"
          >
            <div className="flex items-center gap-4 flex-1">
              <CountryChip code={route.from} label={route.fromLabel} />
              <div className="flex-1 flex items-center gap-2">
                <div className="flex-1 h-[2px] bg-surface-container rounded-full relative overflow-hidden">
                  {route.statusTone === "accent" && (
                    <div className="flow-indicator h-full w-full" />
                  )}
                </div>
                <span className="material-symbols-outlined text-primary/40 text-lg">
                  arrow_forward
                </span>
              </div>
              <CountryChip code={route.to} label={route.toLabel} />
            </div>

            <div className="flex items-center justify-between md:justify-end gap-4 md:gap-8 md:min-w-[320px]">
              <div>
                <p className="text-[0.6875rem] font-bold uppercase tracking-widest text-primary/50">
                  Product
                </p>
                <p className="text-sm text-primary mt-1">{route.product}</p>
              </div>
              <div>
                <p className="text-[0.6875rem] font-bold uppercase tracking-widest text-primary/50">
                  HS
                </p>
                <p className="font-serif italic text-lg text-primary mt-1">
                  {route.hsCode}
                </p>
              </div>
              <StatusChip tone={route.statusTone} label={route.status} />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

function CountryChip({ code, label }: { code: string; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center">
        <span className="font-sans text-xs font-bold tracking-wider text-primary">
          {code}
        </span>
      </div>
      <span className="text-[0.6875rem] font-bold uppercase tracking-widest text-primary/50 mt-2">
        {label}
      </span>
    </div>
  );
}

function StatusChip({ tone, label }: { tone: string; label: string }) {
  const classes =
    tone === "green"
      ? "bg-secondary text-on-secondary"
      : tone === "amber"
        ? "bg-amber-100 text-amber-900"
        : "bg-accent/10 text-accent";
  return (
    <span
      className={`text-[0.6875rem] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full whitespace-nowrap ${classes}`}
    >
      {label}
    </span>
  );
}
