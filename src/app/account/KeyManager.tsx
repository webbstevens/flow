"use client";

import { useState, useTransition } from "react";
import { createKeyAction, revokeKeyAction } from "./actions";
import { maskApiKey } from "@/lib/api-keys";

interface KeyRow {
  id: string;
  prefix: string;
  name: string;
  lastUsedAt: Date | null;
  createdAt: Date;
}

export function KeyManager({ initialKeys }: { initialKeys: KeyRow[] }) {
  const [isPending, startTransition] = useTransition();
  const [newKey, setNewKey] = useState<{
    id: string;
    name: string;
    fullKey: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const form = new FormData();
    form.set("name", name);
    startTransition(async () => {
      const result = await createKeyAction(form);
      if ("error" in result) {
        setError(result.error ?? "Unknown error");
      } else {
        setNewKey({ id: result.id, name: result.name, fullKey: result.fullKey });
        setName("");
      }
    });
  }

  function onRevoke(id: string) {
    if (!confirm("Revoke this key? Any service using it will break.")) return;
    startTransition(async () => {
      const result = await revokeKeyAction(id);
      if ("error" in result) setError(result.error ?? "Unknown error");
    });
  }

  return (
    <>
      {/* One-time reveal card */}
      {newKey && (
        <section className="bg-primary text-white rounded-3xl p-8 mb-6">
          <p className="text-[0.6875rem] font-bold uppercase tracking-widest text-accent">
            New key · {newKey.name}
          </p>
          <p className="text-xs text-white/70 mt-2">
            Copy this now — it will never be shown again.
          </p>
          <div className="mt-4 flex items-center gap-3 bg-white/10 rounded-2xl px-4 py-3">
            <code className="font-mono text-sm text-white flex-1 break-all">
              {newKey.fullKey}
            </code>
            <button
              onClick={() => navigator.clipboard.writeText(newKey.fullKey)}
              className="text-[0.6875rem] font-bold uppercase tracking-widest text-accent whitespace-nowrap"
            >
              Copy
            </button>
          </div>
          <button
            onClick={() => setNewKey(null)}
            className="mt-4 text-xs font-sans text-white/60 hover:text-white transition"
          >
            I&apos;ve saved it, dismiss
          </button>
        </section>
      )}

      {/* Create form */}
      <section className="bg-surface-lowest rounded-3xl p-8 mb-6">
        <p className="text-[0.6875rem] font-bold uppercase tracking-widest text-primary/50 mb-4">
          Create API Key
        </p>
        <form onSubmit={onSubmit} className="flex gap-3">
          <input
            type="text"
            placeholder="Key name (e.g. Production)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={80}
            className="flex-1 bg-surface-container rounded-full px-5 py-3 text-sm text-primary placeholder:text-primary/40 outline-none focus:ring-2 focus:ring-accent"
          />
          <button
            type="submit"
            disabled={isPending || !name.trim()}
            className="bg-primary text-white rounded-full px-6 py-3 text-xs font-bold uppercase tracking-widest disabled:opacity-40 hover:opacity-90 transition"
          >
            {isPending ? "Creating…" : "Create"}
          </button>
        </form>
        {error && (
          <p className="text-xs text-red-600 mt-3 font-sans">{error}</p>
        )}
      </section>

      {/* Key list */}
      <section className="bg-surface-lowest rounded-3xl p-8">
        <p className="text-[0.6875rem] font-bold uppercase tracking-widest text-primary/50 mb-6">
          Active keys ({initialKeys.length})
        </p>
        {initialKeys.length === 0 ? (
          <p className="text-sm text-primary/50">
            No keys yet. Create one above to start using the API.
          </p>
        ) : (
          <ul className="space-y-4">
            {initialKeys.map((k) => (
              <li
                key={k.id}
                className="flex items-center justify-between gap-4 py-2"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-sans text-sm text-primary font-medium">
                    {k.name}
                  </p>
                  <p className="font-mono text-xs text-primary/50 mt-1 truncate">
                    {maskApiKey(k.prefix)}
                  </p>
                  <p className="text-[10px] text-primary/40 mt-1">
                    Created{" "}
                    {new Date(k.createdAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                    {k.lastUsedAt ? (
                      <>
                        {" · Last used "}
                        {new Date(k.lastUsedAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </>
                    ) : (
                      " · Never used"
                    )}
                  </p>
                </div>
                <button
                  onClick={() => onRevoke(k.id)}
                  disabled={isPending}
                  className="text-[0.6875rem] font-bold uppercase tracking-widest text-red-700/80 hover:text-red-800 disabled:opacity-40 transition"
                >
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
