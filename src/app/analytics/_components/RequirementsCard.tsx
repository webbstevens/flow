import type {
  RequirementEnvelope,
  RequiredDocument,
} from "@/lib/requirements";

/**
 * Sidebar card that lists required customs documents for the record's
 * destination country and shows the current validation state
 * (Flow validating → Verified → Edited).
 *
 * Read-only for now. Override UI lands in a follow-up PR.
 */
export function RequirementsCard({
  documentation,
}: {
  documentation: RequirementEnvelope;
}) {
  const required = documentation.required_documents.filter(
    (d) => d.severity === "required",
  );
  const alternatives = documentation.required_documents.filter(
    (d) => d.severity === "alternative",
  );
  const informational = documentation.required_documents.filter(
    (d) => d.severity === "informational",
  );

  return (
    <section className="bg-surface-lowest rounded-2xl p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <p className="font-sans text-[0.6875rem] font-bold uppercase tracking-widest text-primary/50">
          Required documentation
        </p>
        <StatusPill
          status={documentation.status}
          source={documentation.source}
        />
      </div>

      <div className="flex items-baseline justify-between gap-4 pb-3 border-b border-surface-container">
        <span className="font-sans text-xs text-primary/60">Destination</span>
        <span className="font-sans text-sm text-primary font-mono">
          {documentation.destination_country}
        </span>
      </div>

      {documentation.required_documents.length === 0 ? (
        <p className="font-sans text-sm text-primary/60 mt-4">
          No documentation requirements identified.
        </p>
      ) : (
        <div className="space-y-4 mt-4">
          {required.length > 0 && (
            <DocGroup label="Required" docs={required} />
          )}
          {alternatives.length > 0 && (
            <DocGroup
              label="One of"
              docs={alternatives}
              hint="Submit a positive permit OR a negative declaration."
            />
          )}
          {informational.length > 0 && (
            <DocGroup label="Informational" docs={informational} />
          )}
        </div>
      )}

      {documentation.warnings.length > 0 && (
        <div className="mt-4 pt-4 border-t border-surface-container">
          {documentation.warnings.map((w) => (
            <p
              key={w.code}
              className="font-sans text-xs text-amber-800 leading-snug"
            >
              <span className="font-mono text-[0.6875rem] mr-1">{w.code}:</span>
              {w.message}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}

function DocGroup({
  label,
  docs,
  hint,
}: {
  label: string;
  docs: RequiredDocument[];
  hint?: string;
}) {
  return (
    <div>
      <p className="font-sans text-[0.6875rem] font-bold uppercase tracking-widest text-primary/50 mb-2">
        {label}
      </p>
      {hint && (
        <p className="font-sans text-xs text-primary/60 mb-2 italic">{hint}</p>
      )}
      <ul className="space-y-2">
        {docs.map((d) => (
          <li
            key={d.certificate_code}
            className="bg-surface-container rounded-xl px-3 py-2"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-sans text-sm text-primary leading-snug">
                  {d.name}
                </p>
                <p className="font-mono text-[0.6875rem] text-primary/60 mt-0.5">
                  {d.certificate_code}
                  {d.agency !== "NONE" && (
                    <>
                      {" · "}
                      <span className="text-primary/50">{d.agency_name}</span>
                    </>
                  )}
                </p>
              </div>
              <TypeBadge type={d.type} />
            </div>
            {d.note && (
              <p className="font-sans text-xs text-primary/70 mt-1 leading-snug">
                {d.note}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function StatusPill({
  status,
  source,
}: {
  status: RequirementEnvelope["status"];
  source: RequirementEnvelope["source"];
}) {
  if (status === "verified") {
    return (
      <span className="font-sans text-[0.6875rem] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-secondary text-on-secondary">
        Verified · {formatSource(source)}
      </span>
    );
  }
  if (status === "manual_override") {
    return (
      <span className="font-sans text-[0.6875rem] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-surface-container text-primary">
        Edited
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 font-sans text-[0.6875rem] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-amber-100 text-amber-900">
      <span className="relative flex h-1.5 w-1.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75" />
        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-600" />
      </span>
      Flow validating
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  const label: Record<string, string> = {
    C: "Cert",
    L: "Licence",
    U: "Origin",
    X: "Export",
    N: "Doc",
    Y: "Y-decl",
    PGA: "PGA",
  };
  return (
    <span className="font-sans text-[0.625rem] font-bold uppercase tracking-wider text-primary/50 bg-surface-lowest rounded px-1.5 py-0.5 flex-shrink-0">
      {label[type] ?? type}
    </span>
  );
}

function formatSource(source: RequirementEnvelope["source"]): string {
  switch (source) {
    case "uk_trade_tariff":
      return "UK Trade Tariff";
    case "taric":
      return "EU TARIC";
    case "ace":
      return "US ACE";
    case "manual":
      return "Manual";
    default:
      return "AI";
  }
}
