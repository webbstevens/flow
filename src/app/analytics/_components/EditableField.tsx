"use client";

import { useRef, useState, useTransition } from "react";

type SaveStatus = "idle" | "saving" | "saved" | "error";

/**
 * Text / textarea field with auto-save on blur (or Enter for single-line).
 *
 * The parent binds its server action to a (recordId, field) pair and passes
 * it in as `save`. The component only knows how to debounce the commit,
 * swap in a microstatus, and surface errors inline.
 */
export function EditableField({
  initial,
  save,
  multiline = false,
  placeholder = "—",
  maxLength,
  ariaLabel,
}: {
  initial: string | null;
  save: (value: string) => Promise<void>;
  multiline?: boolean;
  placeholder?: string;
  maxLength?: number;
  ariaLabel?: string;
}) {
  const initialString = initial ?? "";
  const [value, setValue] = useState(initialString);
  const [committed, setCommitted] = useState(initialString);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function commit(next: string) {
    if (next === committed) return;
    setStatus("saving");
    setErrorMsg(null);
    startTransition(async () => {
      try {
        await save(next);
        setCommitted(next);
        setStatus("saved");
        if (savedTimer.current) clearTimeout(savedTimer.current);
        savedTimer.current = setTimeout(() => setStatus("idle"), 1500);
      } catch (err) {
        setStatus("error");
        setErrorMsg(err instanceof Error ? err.message : "Save failed");
      }
    });
  }

  const sharedClass =
    "w-full bg-transparent font-sans text-sm text-primary rounded-md px-2 py-1 -mx-2 -my-1 " +
    "border border-transparent hover:border-surface-container focus:border-accent " +
    "focus:outline-none focus:ring-0 transition";

  return (
    <div>
      {multiline ? (
        <textarea
          aria-label={ariaLabel}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => commit(value)}
          placeholder={placeholder}
          maxLength={maxLength}
          rows={3}
          className={`${sharedClass} resize-none`}
        />
      ) : (
        <input
          type="text"
          aria-label={ariaLabel}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => commit(value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
            if (e.key === "Escape") {
              setValue(committed);
              (e.target as HTMLInputElement).blur();
            }
          }}
          placeholder={placeholder}
          maxLength={maxLength}
          className={sharedClass}
        />
      )}
      <StatusLine status={status} pending={isPending} error={errorMsg} />
    </div>
  );
}

/**
 * Yes/No toggle with auto-save on change. Uses a native checkbox styled as
 * a pill, so keyboard + screen reader support come for free.
 */
export function EditableToggle({
  initial,
  save,
  ariaLabel,
}: {
  initial: boolean;
  save: (value: boolean) => Promise<void>;
  ariaLabel?: string;
}) {
  const [value, setValue] = useState(initial);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function commit(next: boolean) {
    const previous = value;
    setValue(next);
    setStatus("saving");
    setErrorMsg(null);
    startTransition(async () => {
      try {
        await save(next);
        setStatus("saved");
        if (savedTimer.current) clearTimeout(savedTimer.current);
        savedTimer.current = setTimeout(() => setStatus("idle"), 1500);
      } catch (err) {
        setValue(previous);
        setStatus("error");
        setErrorMsg(err instanceof Error ? err.message : "Save failed");
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={ariaLabel}
        onClick={() => commit(!value)}
        className={`inline-flex items-center h-6 w-10 rounded-full transition border ${
          value
            ? "bg-accent border-accent"
            : "bg-surface-container border-surface-container"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white shadow transition ${
            value ? "translate-x-5" : "translate-x-1"
          }`}
        />
      </button>
      <span className="font-sans text-sm text-primary">
        {value ? "Yes" : "No"}
      </span>
      <StatusLine status={status} pending={isPending} error={errorMsg} inline />
    </div>
  );
}

function StatusLine({
  status,
  pending,
  error,
  inline = false,
}: {
  status: SaveStatus;
  pending: boolean;
  error: string | null;
  inline?: boolean;
}) {
  const show = status !== "idle" || pending;
  if (!show) return null;
  const label =
    status === "error"
      ? (error ?? "Save failed")
      : status === "saved"
        ? "Saved"
        : "Saving…";
  const tint =
    status === "error" ? "text-red-600" : "text-primary/50";
  return (
    <p
      className={`font-sans text-[0.6875rem] uppercase tracking-widest ${tint} ${
        inline ? "" : "mt-1"
      }`}
    >
      {label}
    </p>
  );
}
