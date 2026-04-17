import type { ReactNode } from "react";

export function ComplianceCard({
  title,
  status,
  children,
}: {
  title: string;
  status?: { label: string; tint: "green" | "amber" | "red" | "neutral" };
  children: ReactNode;
}) {
  const statusTint = status
    ? status.tint === "green"
      ? "bg-secondary text-on-secondary"
      : status.tint === "amber"
        ? "bg-amber-100 text-amber-900"
        : status.tint === "red"
          ? "bg-red-100 text-red-900"
          : "bg-surface-container text-primary"
    : "";
  return (
    <section className="bg-surface-lowest rounded-2xl p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <p className="font-sans text-[0.6875rem] font-bold uppercase tracking-widest text-primary/50">
          {title}
        </p>
        {status && (
          <span
            className={`font-sans text-[0.6875rem] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${statusTint}`}
          >
            {status.label}
          </span>
        )}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function ComplianceRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-surface-container last:border-b-0 pb-3 last:pb-0">
      <span className="font-sans text-xs text-primary/60 flex-shrink-0">
        {label}
      </span>
      <span className="font-sans text-sm text-primary text-right break-words min-w-0">
        {value}
      </span>
    </div>
  );
}
