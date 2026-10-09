"use client";

import * as React from "react";
import { Check, Copy, Plus, Trash2 } from "lucide-react";
import { formatGBP } from "@/core/money";
import { longDay } from "@/core/tools/dates";
import { lateInvoice, type LateInvoiceResult } from "@/core/tools/late-payment";
import { cn } from "@/lib/utils";
import { BigResult, CalculatorShell, Callout, DateInput, Field, MoneyInput, readMoney, readNumber, ShareActions, SuffixInput, useToday, useUrlState } from "./controls";

const MAX_INVOICES = 10;
const DEFAULTS = { inv: "8500_2026-07-01_30", asof: "" };

type Row = { amount: string; date: string; terms: string };

const parseRows = (text: string): Row[] => {
  const rows = text
    .split("~")
    .slice(0, MAX_INVOICES)
    .map((part) => {
      const [amount = "", date = "", terms = "30"] = part.split("_");
      return { amount, date, terms };
    });
  return rows.length ? rows : [{ amount: "", date: "", terms: "30" }];
};
const formatRows = (rows: Row[]) => rows.map((r) => `${r.amount.replace(/[_~]/g, "")}_${r.date}_${r.terms.replace(/[_~]/g, "")}`).join("~");

/** Statutory interest and compensation on one or more late invoices to business customers, with a letter. */
export function LatePaymentCalculator() {
  const [s, set] = useUrlState(DEFAULTS);
  const today = useToday();
  const asOf = s.asof || today;
  const rows = parseRows(s.inv);
  const setRows = (next: Row[]) => set("inv", formatRows(next));
  const update = (i: number, patch: Partial<Row>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const results = rows.map((r) => {
    const amount = readMoney(r.amount);
    const terms = readNumber(r.terms || "30");
    return amount !== null && r.date && asOf ? { row: r, amount, result: lateInvoice({ amountPence: amount, invoiceDate: r.date, termsDays: terms ?? 30 }, asOf) } : null;
  });
  const valid = results.filter((x): x is { row: Row; amount: number; result: LateInvoiceResult } => x !== null && x.result !== null);
  const late = valid.filter((x) => x.result.daysLate > 0);
  const totalInterest = late.reduce((a, x) => a + x.result.interestPence, 0);
  const totalComp = late.reduce((a, x) => a + x.result.compensationPence, 0);
  const owed = late.reduce((a, x) => a + x.amount, 0);
  const perDay = late.reduce((a, x) => a + x.result.dailyInterestPence, 0);
  const estimated = late.some((x) => x.result.rateEstimated);

  return (
    <CalculatorShell
      inputs={
        <>
          <div className="flex flex-col gap-3">
            {rows.map((r, i) => (
              <fieldset key={i} className="rounded-2xl bg-muted p-3.5">
                <legend className="sr-only">Invoice {i + 1}</legend>
                <div className="mb-2 flex items-center justify-between text-[13px] font-medium text-ink-2">
                  Invoice {i + 1}
                  {rows.length > 1 && (
                    <button type="button" onClick={() => setRows(rows.filter((_, j) => j !== i))} className="flex items-center gap-1 text-subtle hover:text-danger" aria-label={`Remove invoice ${i + 1}`}>
                      <Trash2 className="size-3.5" />
                      Remove
                    </button>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-[1.2fr_1.2fr_0.8fr]">
                  <Field label="Amount" htmlFor={`lp-amount-${i}`}>
                    <MoneyInput id={`lp-amount-${i}`} value={r.amount} onChange={(v) => update(i, { amount: v })} invalid={r.amount !== "" && readMoney(r.amount) === null} />
                  </Field>
                  <Field label="Invoice date" htmlFor={`lp-date-${i}`}>
                    <DateInput id={`lp-date-${i}`} value={r.date} onChange={(v) => update(i, { date: v })} />
                  </Field>
                  <Field label="Terms" htmlFor={`lp-terms-${i}`}>
                    <SuffixInput id={`lp-terms-${i}`} suffix="days" value={r.terms} onChange={(v) => update(i, { terms: v })} />
                  </Field>
                </div>
              </fieldset>
            ))}
            {rows.length < MAX_INVOICES && (
              <button
                type="button"
                onClick={() => setRows([...rows, { amount: "", date: "", terms: "30" }])}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl text-[14px] font-medium text-ink shadow-ring hover:bg-muted"
              >
                <Plus className="size-4" />
                Add another invoice
              </button>
            )}
          </div>
          <Field label="Work it out up to" htmlFor="lp-asof" hint="Today, or the day you were paid.">
            <DateInput id="lp-asof" value={asOf} onChange={(v) => set("asof", v)} />
          </Field>
          <p className="text-[12.5px] leading-[1.5] text-subtle">If no payment date was agreed, the law treats it as 30 days after the invoice, so leave terms at 30.</p>
        </>
      }
      results={
        valid.length ? (
          <>
            <BigResult
              label="You can claim"
              value={formatGBP(totalInterest + totalComp)}
              note={late.length ? <>On top of the {formatGBP(owed)} you&apos;re owed. Interest is growing by {formatGBP(perDay)} a day.</> : "Nothing yet: none of these invoices is overdue."}
            />
            {late.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] text-[14px] tabular-nums">
                  <thead>
                    <tr className="text-left text-[12.5px] text-subtle">
                      <th className="py-1.5 pr-2 font-medium">Invoice</th>
                      <th className="py-1.5 pr-2 font-medium">Days late</th>
                      <th className="py-1.5 pr-2 font-medium">Rate</th>
                      <th className="py-1.5 pr-2 font-medium">Interest</th>
                      <th className="py-1.5 font-medium">Fixed sum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {valid.map((x, i) => (
                      <tr key={i} className={cn("border-t border-line", x.result.daysLate === 0 && "text-subtle")}>
                        <td className="py-2 pr-2">{formatGBP(x.amount, 0)}</td>
                        <td className="py-2 pr-2">{x.result.daysLate}</td>
                        <td className="py-2 pr-2">{x.result.ratePct}%</td>
                        <td className="py-2 pr-2">{formatGBP(x.result.interestPence)}</td>
                        <td className="py-2">{formatGBP(x.result.compensationPence, 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {late.length > 0 && (
              <Callout>
                Interest is 8% a year over the Bank of England reference rate ({late[0]!.result.ratePct - 8}%, set on {late[0]!.result.rateSetOn}), simple and daily, from the day after each due
                date. The fixed sum is per invoice. You can also claim reasonable costs of recovering the debt.
                {estimated && " For debts that became late after our latest known rate, check the Bank of England rate before claiming."}
              </Callout>
            )}
            <Callout tone="warn">This applies to invoices to other businesses. Homeowners aren&apos;t covered by the late payment law: you can only charge them interest if your contract says so.</Callout>
            {late.length > 0 && <ClaimLetter late={late} asOf={asOf} interest={totalInterest} comp={totalComp} perDay={perDay} />}
            <ShareActions />
          </>
        ) : (
          <Callout tone="warn">Enter an invoice amount and date to see what you can claim.</Callout>
        )
      }
    />
  );
}

function ClaimLetter({ late, asOf, interest, comp, perDay }: { late: { amount: number; row: Row; result: LateInvoiceResult }[]; asOf: string; interest: number; comp: number; perDay: number }) {
  const [copied, setCopied] = React.useState(false);
  const lines = late.map((x) => `- Invoice dated ${longDay(x.row.date)} for ${formatGBP(x.amount)}, due ${longDay(x.result.dueDate)}: ${x.result.daysLate} days late, interest ${formatGBP(x.result.interestPence)}, fixed sum ${formatGBP(x.result.compensationPence, 0)}`);
  const owed = late.reduce((a, x) => a + x.amount, 0);
  const text = [
    "Dear [name],",
    "",
    `The following ${late.length === 1 ? "invoice is" : "invoices are"} overdue:`,
    "",
    ...lines,
    "",
    `Under the Late Payment of Commercial Debts (Interest) Act 1998, we are entitled to statutory interest and a fixed sum for each late invoice. As of ${longDay(asOf)}, that comes to ${formatGBP(interest)} in interest and ${formatGBP(comp, 0)} in fixed sums, making ${formatGBP(owed + interest + comp)} in total including the ${formatGBP(owed)} outstanding.`,
    "",
    `Interest continues to build up at ${formatGBP(perDay)} a day until payment is received. Please pay the full amount within 7 days to [bank details].`,
    "",
    "Kind regards,",
    "[your name]",
  ].join("\n");
  return (
    <details className="group rounded-xl bg-white shadow-ring">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-[14px] font-medium text-ink [&::-webkit-details-marker]:hidden">
        A letter claiming this
        <span className="text-[12.5px] font-normal text-subtle group-open:hidden">Show</span>
      </summary>
      <div className="border-t border-hairline px-4 pt-3 pb-4">
        <pre className="font-sans text-[13.5px] leading-[1.55] whitespace-pre-wrap text-ink-2">{text}</pre>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              // Clipboard blocked: the text is on screen to copy by hand.
            }
          }}
          className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-lg bg-ink px-3 text-[13.5px] font-medium text-white print:hidden"
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? "Copied" : "Copy the letter"}
        </button>
      </div>
    </details>
  );
}
