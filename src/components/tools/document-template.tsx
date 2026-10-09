"use client";

import * as React from "react";
import { ImagePlus, Plus, Printer, RotateCcw, Trash2 } from "lucide-react";
import { formatGBP } from "@/core/money";
import { addDaysIso, longDay } from "@/core/tools/dates";
import { docTotals, VAT_LABEL, type DocVat, type LineKind } from "@/core/tools/document";
import { cn } from "@/lib/utils";
import { Field, readMoney, readNumber, Segmented } from "./controls";

/**
 * The free quote and invoice templates: fill in a form, see the document beside it, print or save it as a
 * PDF. Nothing is sent anywhere: the draft and your business details stay in this browser.
 */

export type DocKind = "quote" | "invoice";

type Line = { description: string; quantity: string; unit: string; rate: string; kind: LineKind };
type Business = { name: string; address: string; phone: string; email: string; vatNumber: string; logo: string };
type Draft = {
  number: string;
  date: string;
  days: string;
  clientName: string;
  clientAddress: string;
  clientEmail: string;
  jobAddress: string;
  title: string;
  lines: Line[];
  vat: DocVat;
  cis: "0" | "2000" | "3000";
  payment: string;
  exclusions: string;
  notes: string;
  bankName: string;
  sortCode: string;
  account: string;
};

const BUSINESS_KEY = "bos-tools-business-v1";
const draftKey = (kind: DocKind) => `bos-tools-${kind}-v1`;
const MAX_LINES = 40;

const EMPTY_BUSINESS: Business = { name: "", address: "", phone: "", email: "", vatNumber: "", logo: "" };

const sampleLines = (kind: DocKind): Line[] =>
  kind === "quote"
    ? [
        { description: "Strip out existing kitchen and remove waste", quantity: "1", unit: "item", rate: "850", kind: "labour" },
        { description: "First fix electrics and plumbing", quantity: "1", unit: "item", rate: "1450", kind: "labour" },
        { description: "Plasterboard and skim, walls and ceiling", quantity: "32", unit: "m²", rate: "28", kind: "labour" },
        { description: "Supply and fit LVT flooring", quantity: "14", unit: "m²", rate: "65", kind: "materials" },
      ]
    : [
        { description: "Labour: second fix carpentry, 5 days", quantity: "5", unit: "day", rate: "260", kind: "labour" },
        { description: "Materials: architrave, skirting and fixings", quantity: "1", unit: "item", rate: "340", kind: "materials" },
      ];

const newDraft = (kind: DocKind, today: string): Draft => ({
  number: kind === "quote" ? "Q-001" : "INV-001",
  date: today,
  days: kind === "quote" ? "30" : "14",
  clientName: "",
  clientAddress: "",
  clientEmail: "",
  jobAddress: "",
  title: kind === "quote" ? "Kitchen refurbishment" : "",
  lines: sampleLines(kind),
  vat: "standard",
  cis: "0",
  payment: kind === "quote" ? "25% deposit to book your start date, 50% at first fix, and the final 25% on completion." : "",
  exclusions: kind === "quote" ? "Kitchen units, worktops and appliances (supplied by the client). Any work not listed above." : "",
  notes: kind === "quote" ? "Any changes to the work will be priced and agreed in writing before they're carried out." : "Thank you for your business.",
  bankName: "",
  sortCode: "",
  account: "",
});

function load<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? { ...fallback, ...(JSON.parse(raw) as T) } : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the document still works, it just won't be remembered.
  }
}

const noSubscribe = () => () => {};

/** Mounts the editor only in the browser, where the saved draft can be read. */
export function DocumentTemplate({ kind }: { kind: DocKind }) {
  const inBrowser = React.useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );
  if (!inBrowser) return <div className="h-[720px] rounded-[24px] bg-white shadow-ring" aria-busy="true" />;
  return <Editor kind={kind} />;
}

function Editor({ kind }: { kind: DocKind }) {
  const today = new Date().toISOString().slice(0, 10);
  const [business, setBusiness] = React.useState<Business>(() => load(BUSINESS_KEY, EMPTY_BUSINESS));
  const [d, setDraft] = React.useState<Draft>(() => load(draftKey(kind), newDraft(kind, today)));

  React.useEffect(() => save(BUSINESS_KEY, business), [business]);
  React.useEffect(() => save(draftKey(kind), d), [kind, d]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((x) => ({ ...x, [k]: v }));
  const setB = <K extends keyof Business>(k: K, v: Business[K]) => setBusiness((x) => ({ ...x, [k]: v }));
  const setLine = (i: number, patch: Partial<Line>) => set("lines", d.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  const lines = d.lines.map((l) => ({ description: l.description, quantity: readNumber(l.quantity || "0") ?? 0, ratePence: readMoney(l.rate || "0") ?? 0, kind: l.kind }));
  const cisRate = kind === "invoice" ? Number(d.cis) : 0;
  const totals = docTotals(lines, d.vat, cisRate);
  const days = readNumber(d.days) ?? 0;
  const endDate = d.date && /^\d{4}-\d{2}-\d{2}$/.test(d.date) ? addDaysIso(d.date, Math.max(0, Math.round(days))) : null;

  const pickLogo = (file: File | undefined) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        // Shrink big logos so the draft stays small enough to keep in the browser.
        const scale = Math.min(1, 480 / img.width, 240 / img.height);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
        setB("logo", canvas.toDataURL("image/png"));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const input = "h-11 w-full min-w-0 rounded-xl bg-white px-3 text-[15px] text-ink shadow-ring-input outline-none placeholder:text-faint focus:shadow-[0_0_0_1.5px_var(--color-ink),0_0_0_4px_rgb(16_16_15/0.08)]";
  const area = cn(input, "h-auto min-h-[76px] py-2.5 leading-[1.45]");
  const label = kind === "quote" ? "Quote" : "Invoice";

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,440px)_minmax(0,1fr)]">
      <div className="flex flex-col gap-5 rounded-[24px] bg-white p-5 shadow-ring sm:p-6 print:hidden">
        <Section title="Your business">
          <div className="flex items-center gap-3">
            {business.logo ? (
              // eslint-disable-next-line @next/next/no-img-element -- a local preview of the user's own logo
              <img src={business.logo} alt="Your logo" className="h-14 max-w-[140px] rounded-lg object-contain shadow-ring" />
            ) : (
              <span className="flex size-14 items-center justify-center rounded-lg bg-muted text-subtle">
                <ImagePlus className="size-5" />
              </span>
            )}
            <label className="cursor-pointer text-[14px] font-medium text-ink underline underline-offset-2">
              {business.logo ? "Change logo" : "Add your logo"}
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => pickLogo(e.target.files?.[0])} />
            </label>
            {business.logo && (
              <button type="button" onClick={() => setB("logo", "")} className="text-[13px] text-subtle hover:text-ink">
                Remove
              </button>
            )}
          </div>
          <input aria-label="Business name" className={input} placeholder="Business name" value={business.name} onChange={(e) => setB("name", e.target.value)} />
          <textarea aria-label="Business address" className={area} placeholder="Address" value={business.address} onChange={(e) => setB("address", e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <input aria-label="Phone" className={input} placeholder="Phone" value={business.phone} onChange={(e) => setB("phone", e.target.value)} />
            <input aria-label="Email" className={input} placeholder="Email" value={business.email} onChange={(e) => setB("email", e.target.value)} />
          </div>
          <input aria-label="VAT number" className={input} placeholder="VAT number (if registered)" value={business.vatNumber} onChange={(e) => setB("vatNumber", e.target.value)} />
        </Section>

        <Section title={kind === "quote" ? "Client and job" : "Bill to"}>
          <input aria-label="Client name" className={input} placeholder="Client name" value={d.clientName} onChange={(e) => set("clientName", e.target.value)} />
          <textarea aria-label="Client address" className={area} placeholder="Client address" value={d.clientAddress} onChange={(e) => set("clientAddress", e.target.value)} />
          <input aria-label="Job address" className={input} placeholder="Job address, if different" value={d.jobAddress} onChange={(e) => set("jobAddress", e.target.value)} />
          <input aria-label="Job title" className={input} placeholder={kind === "quote" ? "Job, e.g. Kitchen refurbishment" : "Job or reference (optional)"} value={d.title} onChange={(e) => set("title", e.target.value)} />
        </Section>

        <Section title={`${label} details`}>
          <div className="grid grid-cols-[1fr_1.5fr_1fr] gap-2">
            <Field label="Number" htmlFor="doc-number">
              <input id="doc-number" className={input} value={d.number} onChange={(e) => set("number", e.target.value)} />
            </Field>
            <Field label="Date" htmlFor="doc-date">
              <input id="doc-date" type="date" className={input} value={d.date} onChange={(e) => set("date", e.target.value)} />
            </Field>
            <Field label={kind === "quote" ? "Valid for" : "Due in"} htmlFor="doc-days">
              <div className="relative">
                <input id="doc-days" inputMode="numeric" className={cn(input, "pr-11")} value={d.days} onChange={(e) => set("days", e.target.value)} />
                <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[13px] text-subtle">days</span>
              </div>
            </Field>
          </div>
        </Section>

        <Section title="Work and prices">
          <div className="flex flex-col gap-2.5">
            {d.lines.map((l, i) => (
              <div key={i} className="rounded-xl bg-muted p-2.5">
                <div className="flex gap-2">
                  <textarea
                    aria-label={`Line ${i + 1} description`}
                    className={cn(area, "min-h-[64px]")}
                    rows={2}
                    placeholder="Description"
                    value={l.description}
                    onChange={(e) => setLine(i, { description: e.target.value })}
                  />
                  <button type="button" onClick={() => set("lines", d.lines.filter((_, j) => j !== i))} aria-label={`Remove line ${i + 1}`} className="flex size-11 flex-none items-center justify-center rounded-xl text-subtle hover:text-danger">
                    <Trash2 className="size-4" />
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-[1fr_1fr_1.3fr] gap-2">
                  <input aria-label={`Line ${i + 1} quantity`} inputMode="decimal" className={input} placeholder="Qty" value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} />
                  <input aria-label={`Line ${i + 1} unit`} className={input} placeholder="Unit" value={l.unit} onChange={(e) => setLine(i, { unit: e.target.value })} />
                  <div className="relative">
                    <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[14px] text-subtle">£</span>
                    <input aria-label={`Line ${i + 1} rate`} inputMode="decimal" className={cn(input, "pl-7")} placeholder="Rate" value={l.rate} onChange={(e) => setLine(i, { rate: e.target.value })} />
                  </div>
                </div>
                {kind === "invoice" && d.cis !== "0" && (
                  <Segmented
                    label={`Line ${i + 1} type`}
                    className="mt-2"
                    value={l.kind}
                    onChange={(v) => setLine(i, { kind: v })}
                    options={[
                      { value: "labour", label: "Labour" },
                      { value: "materials", label: "Materials" },
                      { value: "other", label: "Other" },
                    ]}
                  />
                )}
              </div>
            ))}
            {d.lines.length < MAX_LINES && (
              <button
                type="button"
                onClick={() => set("lines", [...d.lines, { description: "", quantity: "1", unit: "item", rate: "", kind: "labour" }])}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl text-[14px] font-medium text-ink shadow-ring hover:bg-muted"
              >
                <Plus className="size-4" />
                Add a line
              </button>
            )}
          </div>
        </Section>

        <Section title="VAT">
          <Segmented
            label="VAT"
            value={d.vat}
            onChange={(v) => set("vat", v)}
            options={[
              { value: "standard", label: "20%" },
              { value: "reduced", label: "5%" },
              { value: "none", label: "None" },
              { value: "reverse_charge", label: "Reverse charge" },
            ]}
          />
          {kind === "invoice" && (
            <Field label="CIS deduction (if you're a subcontractor under CIS)">
              <Segmented
                label="CIS deduction"
                value={d.cis}
                onChange={(v) => set("cis", v)}
                options={[
                  { value: "0", label: "None" },
                  { value: "2000", label: "20%" },
                  { value: "3000", label: "30%" },
                ]}
              />
            </Field>
          )}
        </Section>

        {kind === "quote" ? (
          <Section title="Terms">
            <Field label="Payment stages" htmlFor="doc-payment">
              <textarea id="doc-payment" className={area} value={d.payment} onChange={(e) => set("payment", e.target.value)} />
            </Field>
            <Field label="Not included" htmlFor="doc-excl">
              <textarea id="doc-excl" className={area} value={d.exclusions} onChange={(e) => set("exclusions", e.target.value)} />
            </Field>
            <Field label="Notes" htmlFor="doc-notes">
              <textarea id="doc-notes" className={area} value={d.notes} onChange={(e) => set("notes", e.target.value)} />
            </Field>
          </Section>
        ) : (
          <Section title="How to pay">
            <input aria-label="Account name" className={input} placeholder="Account name" value={d.bankName} onChange={(e) => set("bankName", e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <input aria-label="Sort code" className={input} placeholder="Sort code" value={d.sortCode} onChange={(e) => set("sortCode", e.target.value)} />
              <input aria-label="Account number" className={input} placeholder="Account number" value={d.account} onChange={(e) => set("account", e.target.value)} />
            </div>
            <Field label="Notes" htmlFor="doc-notes">
              <textarea id="doc-notes" className={area} value={d.notes} onChange={(e) => set("notes", e.target.value)} />
            </Field>
          </Section>
        )}

        <div className="flex flex-wrap gap-2 border-t border-hairline pt-4">
          <button type="button" onClick={() => window.print()} className="inline-flex h-11 items-center gap-2 rounded-xl bg-ink px-4 text-[15px] font-medium text-white hover:bg-ink-2">
            <Printer className="size-4" />
            Download PDF
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`Start a new ${kind}? Your business details are kept.`)) setDraft(newDraft(kind, today));
            }}
            className="inline-flex h-11 items-center gap-1.5 rounded-xl px-4 text-[14px] font-medium text-ink-2 shadow-ring hover:text-ink"
          >
            <RotateCcw className="size-4" />
            Start again
          </button>
          <p className="w-full text-[12.5px] leading-[1.45] text-subtle">
            Choose &ldquo;Save as PDF&rdquo; in the print window. Your details are saved in this browser only, never sent to us.
          </p>
        </div>
      </div>

      <Preview kind={kind} business={business} d={d} lines={lines} totals={totals} endDate={endDate} />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-2.5">
      <legend className="mb-2.5 text-[15px] font-semibold text-ink">{title}</legend>
      {children}
    </fieldset>
  );
}

function Multiline({ text, className }: { text: string; className?: string }) {
  if (!text.trim()) return null;
  return <div className={cn("whitespace-pre-line", className)}>{text}</div>;
}

function Preview({
  kind,
  business,
  d,
  lines,
  totals,
  endDate,
}: {
  kind: DocKind;
  business: Business;
  d: Draft;
  lines: { description: string; quantity: number; ratePence: number }[];
  totals: ReturnType<typeof docTotals>;
  endDate: string | null;
}) {
  const quote = kind === "quote";
  const money = (p: number) => formatGBP(p);
  return (
    <div className="min-w-0 xl:sticky xl:top-24 xl:self-start">
      <div className="mb-2 flex items-center justify-between text-[13px] text-subtle print:hidden">
        <span>Preview</span>
        <span>A4</span>
      </div>
      <article className="doc-print mx-auto w-full max-w-[794px] overflow-hidden rounded-[6px] bg-white px-[clamp(20px,5vw,56px)] py-[clamp(24px,5vw,56px)] font-sans text-[12.5px] leading-[1.5] text-ink shadow-[0_0_0_1px_#E8E7E3,0_16px_48px_-24px_rgb(16_16_15/0.35)] print:max-w-none print:rounded-none print:p-0 print:shadow-none">
        <header className="flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0">
            {business.logo && (
              // eslint-disable-next-line @next/next/no-img-element -- the user's own logo, kept in their browser
              <img src={business.logo} alt="" className="mb-3 max-h-16 max-w-[200px] object-contain" />
            )}
            <div className="text-[15px] font-semibold">{business.name || "Your business name"}</div>
            <Multiline text={business.address} className="text-ink-2" />
            <div className="text-ink-2">{[business.phone, business.email].filter(Boolean).join(" · ")}</div>
          </div>
          <div className="text-right">
            <div className="text-[26px] leading-none font-semibold tracking-[-0.02em]">{quote ? "Quote" : "Invoice"}</div>
            <dl className="mt-3 grid grid-cols-[auto_auto] justify-end gap-x-3 gap-y-0.5 text-ink-2">
              <dt>Number</dt>
              <dd className="text-ink">{d.number}</dd>
              {d.date && (
                <>
                  <dt>Date</dt>
                  <dd className="text-ink">{longDay(d.date)}</dd>
                </>
              )}
              {endDate && (
                <>
                  <dt>{quote ? "Valid until" : "Due"}</dt>
                  <dd className="text-ink">{longDay(endDate)}</dd>
                </>
              )}
            </dl>
          </div>
        </header>

        <div className="mt-8 grid gap-6 sm:grid-cols-2 print:grid-cols-2">
          <div>
            <div className="text-[11px] font-medium tracking-wide text-subtle uppercase">{quote ? "Prepared for" : "Bill to"}</div>
            <div className="mt-1 font-medium">{d.clientName || "Client name"}</div>
            <Multiline text={d.clientAddress} className="text-ink-2" />
          </div>
          {(d.jobAddress || d.title) && (
            <div>
              <div className="text-[11px] font-medium tracking-wide text-subtle uppercase">Job</div>
              {d.title && <div className="mt-1 font-medium">{d.title}</div>}
              {d.jobAddress && <div className="text-ink-2">{d.jobAddress}</div>}
            </div>
          )}
        </div>

        <table className="mt-8 w-full text-left tabular-nums">
          <thead>
            <tr className="border-b border-ink text-[11px] tracking-wide text-subtle uppercase">
              <th className="py-2 pr-3 font-medium">Description</th>
              <th className="py-2 pr-3 text-right font-medium">Qty</th>
              <th className="py-2 pr-3 text-right font-medium">Rate</th>
              <th className="py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {d.lines.map((l, i) =>
              l.description || lines[i]!.ratePence ? (
                <tr key={i} className="border-b border-line align-top">
                  <td className="py-2 pr-3 whitespace-pre-line">{l.description}</td>
                  <td className="py-2 pr-3 text-right whitespace-nowrap">
                    {Number(lines[i]!.quantity.toFixed(2))} {l.unit}
                  </td>
                  <td className="py-2 pr-3 text-right">{money(lines[i]!.ratePence)}</td>
                  <td className="py-2 text-right">{money(totals.lineTotals[i]!)}</td>
                </tr>
              ) : null,
            )}
          </tbody>
        </table>

        <div className="mt-4 ml-auto w-full max-w-[300px]">
          <dl className="flex flex-col tabular-nums">
            <Total label="Subtotal" value={money(totals.netPence)} />
            {d.vat === "standard" || d.vat === "reduced" ? <Total label={VAT_LABEL[d.vat]} value={money(totals.vatPence)} /> : null}
            {d.vat === "reverse_charge" && <Total label="VAT at 20% (reverse charge)" value={money(totals.reverseChargeVatPence)} muted />}
            <Total label="Total" value={money(totals.totalPence)} strong />
            {totals.cisDeductionPence > 0 && <Total label={`Less CIS at ${totals.cisRateBps / 100}% on labour of ${money(totals.labourPence)}`} value={`−${money(totals.cisDeductionPence)}`} />}
            {totals.cisDeductionPence > 0 && <Total label="Amount due" value={money(totals.amountDuePence)} strong />}
          </dl>
        </div>
        {d.vat === "reverse_charge" && <p className="mt-3 text-right font-medium">Reverse charge: customer to pay the VAT to HMRC.</p>}

        <div className="mt-8 flex flex-col gap-4">
          {quote && d.payment.trim() && <Block title="Payment">{d.payment}</Block>}
          {quote && d.exclusions.trim() && <Block title="Not included">{d.exclusions}</Block>}
          {!quote && (d.bankName || d.sortCode || d.account) && (
            <Block title="How to pay">
              {[d.bankName && `Account name: ${d.bankName}`, d.sortCode && `Sort code: ${d.sortCode}`, d.account && `Account number: ${d.account}`, `Reference: ${d.number}`].filter(Boolean).join("\n")}
            </Block>
          )}
          {d.notes.trim() && <Block title="Notes">{d.notes}</Block>}
        </div>

        {quote && (
          <div className="mt-10 grid grid-cols-2 gap-8 border-t border-hairline pt-5 text-ink-2">
            <div>
              Accepted by
              <div className="mt-8 border-b border-ink-4" />
            </div>
            <div>
              Date
              <div className="mt-8 border-b border-ink-4" />
            </div>
          </div>
        )}

        <footer className="mt-10 flex flex-wrap justify-between gap-2 border-t border-hairline pt-3 text-[10.5px] text-subtle">
          <span>{business.vatNumber ? `VAT number ${business.vatNumber}` : ""}</span>
          <span>Made with the free {quote ? "quote" : "invoice"} template at builder-os.co.uk</span>
        </footer>
      </article>
    </div>
  );
}

function Total({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div className={cn("flex justify-between gap-4 border-b border-line py-1.5 last:border-b-0", strong && "text-[14px] font-semibold", muted && "text-subtle")}>
      <dt>{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-medium tracking-wide text-subtle uppercase">{title}</div>
      <div className="mt-1 whitespace-pre-line text-ink-2">{children}</div>
    </div>
  );
}
