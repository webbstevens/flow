type Kind = "confidence" | "needs_review" | "restricted" | "high_confidence";

export function ComplianceBadge({
  kind,
  confidence,
}: {
  kind: Kind;
  confidence?: number;
}) {
  if (kind === "confidence" && typeof confidence === "number") {
    const tint =
      confidence >= 90
        ? "bg-secondary text-on-secondary"
        : confidence >= 70
          ? "bg-emerald-50 text-emerald-900"
          : "bg-amber-100 text-amber-900";
    return (
      <span
        className={`font-sans text-[0.6875rem] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${tint}`}
      >
        {confidence}%
      </span>
    );
  }
  if (kind === "needs_review") {
    return (
      <span className="font-sans text-[0.6875rem] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-amber-100 text-amber-900">
        Needs review
      </span>
    );
  }
  if (kind === "restricted") {
    return (
      <span className="font-sans text-[0.6875rem] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-red-100 text-red-900">
        Restricted
      </span>
    );
  }
  if (kind === "high_confidence") {
    return (
      <span className="font-sans text-[0.6875rem] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-secondary text-on-secondary">
        Verified
      </span>
    );
  }
  return null;
}
