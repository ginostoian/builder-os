"use client";

import * as React from "react";
import { Check, Link2, Printer } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Inputs and result pieces shared by the free tools. Amounts are typed as text (so "1,250" and "£1250"
 * both work) and read with `readMoney`/`readNumber`.
 */

/** "£1,250.50" → 125050 pence; null when empty or not a number. Up to £100m. */
export function readMoney(text: string): number | null {
  const cleaned = text.replace(/[£,\s]/g, "");
  if (!/^(\d+(\.\d{0,2})?|\.\d{1,2})$/.test(cleaned)) return null;
  const pence = Math.round(Number(cleaned) * 100);
  return pence <= 100_000_000_00 ? pence : null;
}

/** "12.5" or "12.5%" → 12.5; null when empty or not a number. */
export function readNumber(text: string): number | null {
  const cleaned = text.replace(/[%,\s]/g, "");
  if (!/^-?(\d+(\.\d*)?|\.\d+)$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

const fieldShell = "flex h-12 items-center rounded-xl bg-white shadow-ring-input focus-within:shadow-[0_0_0_1.5px_var(--color-ink),0_0_0_4px_rgb(16_16_15/0.08)]";

/** A labelled input. Without `htmlFor` (for a group of buttons, which names itself) the label is plain text. */
export function Field({ label, hint, htmlFor, children, className }: { label: string; hint?: React.ReactNode; htmlFor?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {htmlFor ? (
        <label htmlFor={htmlFor} className="text-[14px] font-medium text-ink">
          {label}
        </label>
      ) : (
        <div className="text-[14px] font-medium text-ink" aria-hidden>
          {label}
        </div>
      )}
      {children}
      {hint && <p className="text-[12.5px] leading-[1.45] text-subtle">{hint}</p>}
    </div>
  );
}

export function MoneyInput({ id, value, onChange, placeholder = "0", invalid }: { id: string; value: string; onChange: (v: string) => void; placeholder?: string; invalid?: boolean }) {
  return (
    <div className={cn(fieldShell, invalid && "shadow-[0_0_0_1.5px_var(--color-danger)]")}>
      <span className="pl-3.5 text-[16px] text-subtle" aria-hidden>
        £
      </span>
      <input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid || undefined}
        className="h-full w-full min-w-0 bg-transparent px-2 text-[16px] text-ink tabular-nums outline-none placeholder:text-faint"
      />
    </div>
  );
}

export function SuffixInput({ id, value, onChange, suffix, placeholder = "0", invalid }: { id: string; value: string; onChange: (v: string) => void; suffix: string; placeholder?: string; invalid?: boolean }) {
  return (
    <div className={cn(fieldShell, invalid && "shadow-[0_0_0_1.5px_var(--color-danger)]")}>
      <input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid || undefined}
        className="h-full w-full min-w-0 bg-transparent pl-3.5 text-[16px] text-ink tabular-nums outline-none placeholder:text-faint"
      />
      <span className="pr-3.5 text-[15px] whitespace-nowrap text-subtle" aria-hidden>
        {suffix}
      </span>
    </div>
  );
}

export function DateInput({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  return (
    <input
      id={id}
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-12 w-full min-w-0 rounded-xl bg-white px-3.5 text-[16px] text-ink shadow-ring-input outline-none focus:shadow-[0_0_0_1.5px_var(--color-ink),0_0_0_4px_rgb(16_16_15/0.08)]"
    />
  );
}

/** A row of mutually exclusive choices (a radio group that looks like a segmented control). */
export function Segmented<T extends string>({ label, value, options, onChange, className }: { label: string; value: T; options: { value: T; label: string; sub?: string }[]; onChange: (v: T) => void; className?: string }) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("grid gap-1 rounded-xl bg-muted p-1", className)} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cn(
              "flex min-h-10 flex-col items-center justify-center rounded-[9px] px-2 py-1.5 text-center text-[13.5px] leading-[1.2] font-medium transition-colors",
              on ? "bg-white text-ink shadow-ring" : "text-ink-2 hover:text-ink",
            )}
          >
            {o.label}
            {o.sub && <span className={cn("mt-0.5 text-[11.5px] font-normal", on ? "text-ink-2" : "text-subtle")}>{o.sub}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** The panel holding a tool's inputs (left) and results (right). */
export function CalculatorShell({ inputs, results }: { inputs: React.ReactNode; results: React.ReactNode }) {
  return (
    <div className="grid overflow-hidden rounded-[24px] bg-white shadow-ring lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="flex flex-col gap-5 p-5 sm:p-7 print:hidden">{inputs}</div>
      <div className="flex flex-col gap-5 border-t border-hairline bg-surface-2 p-5 sm:p-7 lg:border-t-0 lg:border-l">{results}</div>
    </div>
  );
}

/** The headline figure. */
export function BigResult({ label, value, note, tone }: { label: string; value: string; note?: React.ReactNode; tone?: "good" | "bad" }) {
  return (
    <div aria-live="polite">
      <div className="text-[14px] font-medium text-ink-2">{label}</div>
      <div className={cn("mt-1 text-[clamp(36px,5vw,52px)] leading-none font-semibold tracking-[-0.04em] tabular-nums", tone === "bad" ? "text-danger" : tone === "good" ? "text-success" : "text-ink")}>
        {value}
      </div>
      {note && <div className="mt-2 text-[14px] leading-[1.5] text-ink-2">{note}</div>}
    </div>
  );
}

/** A breakdown table: label on the left, amount on the right; `strong` rows are totals. */
export function Rows({ rows }: { rows: { label: React.ReactNode; value: string; strong?: boolean; muted?: boolean }[] }) {
  return (
    <dl className="flex flex-col">
      {rows.map((r, i) => (
        <div key={i} className={cn("flex items-baseline justify-between gap-4 border-b border-line py-2.5 text-[15px] last:border-b-0", r.strong && "font-semibold text-ink", r.muted && "text-subtle")}>
          <dt className={cn(!r.strong && !r.muted && "text-ink-2")}>{r.label}</dt>
          <dd className="text-right tabular-nums">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Callout({ tone = "info", children }: { tone?: "info" | "warn" | "good"; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-xl px-4 py-3 text-[14px] leading-[1.55]",
        tone === "warn" ? "bg-warning-soft text-ink" : tone === "good" ? "bg-success-soft text-ink" : "bg-muted text-ink-2",
      )}
    >
      {children}
    </div>
  );
}

/** Copy a link to these exact figures, or print / save as PDF. */
export function ShareActions() {
  const [copied, setCopied] = React.useState(false);
  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(window.location.href);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            window.prompt("Copy this link", window.location.href);
          }
        }}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white px-3 text-[13.5px] font-medium text-ink shadow-ring hover:bg-muted"
      >
        {copied ? <Check className="size-3.5 text-success" /> : <Link2 className="size-3.5" />}
        {copied ? "Link copied" : "Copy link to these figures"}
      </button>
      <button type="button" onClick={() => window.print()} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white px-3 text-[13.5px] font-medium text-ink shadow-ring hover:bg-muted">
        <Printer className="size-3.5" />
        Print or save as PDF
      </button>
    </div>
  );
}

const noSubscribe = () => () => {};
const readSearch = () => window.location.search;
const serverSearch = () => "";

/**
 * Keeps a tool's inputs in the address bar, so a result can be bookmarked or shared. The page is static,
 * so the link is read after it loads; changes show at once and reach the address bar a moment later
 * (browsers limit how often a page may rewrite it).
 */
export function useUrlState<T extends Record<string, string>>(defaults: T): [T, <K extends keyof T>(key: K, value: T[K]) => void, (next: Partial<T>) => void] {
  const search = React.useSyncExternalStore(noSubscribe, readSearch, serverSearch);
  const [local, setLocal] = React.useState<Partial<T>>({});

  const state = React.useMemo(() => {
    const params = new URLSearchParams(search);
    const fromUrl: Partial<T> = {};
    for (const key of Object.keys(defaults) as (keyof T & string)[]) {
      const v = params.get(key);
      if (v !== null && v.length <= 200) fromUrl[key] = v as T[typeof key];
    }
    return { ...defaults, ...fromUrl, ...local };
  }, [search, defaults, local]);

  React.useEffect(() => {
    if (Object.keys(local).length === 0) return;
    const t = setTimeout(() => {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(state)) if (v !== "" && v !== defaults[k]) params.set(k, v);
      const qs = params.toString();
      window.history.replaceState(window.history.state, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
    }, 400);
    return () => clearTimeout(t);
  }, [state, local, defaults]);

  const merge = React.useCallback((next: Partial<T>) => setLocal((l) => ({ ...l, ...next })), []);
  const set = React.useCallback(<K extends keyof T>(key: K, value: T[K]) => setLocal((l) => ({ ...l, [key]: value })), []);
  return [state, set, merge];
}

const todayIso = () => new Date().toISOString().slice(0, 10);

/** Today's date (YYYY-MM-DD) in the browser; empty while the static page is being built. */
export const useToday = () => React.useSyncExternalStore(noSubscribe, todayIso, serverSearch);
