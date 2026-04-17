type Tint = "neutral" | "green" | "amber" | "red";

const VALUE_TINT: Record<Tint, string> = {
  neutral: "text-primary",
  green: "text-on-secondary",
  amber: "text-amber-900",
  red: "text-red-700",
};

export function MetricCard({
  label,
  value,
  sub,
  tint = "neutral",
}: {
  label: string;
  value: string | number;
  sub?: string;
  tint?: Tint;
}) {
  return (
    <div className="bg-surface-lowest rounded-3xl p-6">
      <p className="font-sans text-[0.6875rem] font-bold uppercase tracking-widest text-primary/50">
        {label}
      </p>
      <p
        className={`font-serif italic text-4xl mt-2 tracking-tight ${VALUE_TINT[tint]}`}
      >
        {value}
      </p>
      {sub && <p className="font-sans text-xs text-primary/50 mt-2">{sub}</p>}
    </div>
  );
}
