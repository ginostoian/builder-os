"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { formatGBP } from "@/core/money";
import { marginToMarkup, markupToMargin, pct } from "@/core/tools/margin";
import { OVERHEAD_SUGGESTIONS, VAT_THRESHOLD_PENCE, marginSensitivity, profitForTurnover, turnoverForProfit, type ProfitPlan } from "@/core/tools/profit-target";
import { cn } from "@/lib/utils";
import { BigResult, CalculatorShell, Callout, Field, MoneyInput, readMoney, readNumber, Segmented, ShareActions, SuffixInput, useUrlState } from "./controls";

const DEFAULTS = {
  mode: "target",
  profit: "60000",
  turnover: "250000",
  overheads: "30000",
  breakdown: "",
  basis: "margin",
  rate: "30",
  job: "15000",
  win: "25",
  weeks: "46",
};

const ONE_DP = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });
const count = (n: number) => ONE_DP.format(n);

/** The overhead breakdown travels in the link as amounts separated by "~", in the order of the suggestions. */
const readBreakdown = (text: string) => {
  const parts = text.split("~");
  return OVERHEAD_SUGGESTIONS.map((_, i) => parts[i] ?? "");
};

export function RevenueProfitCalculator() {
  const [s, set, merge] = useUrlState(DEFAULTS);
  // Open when chosen, or when a shared link carries a breakdown.
  const [open, setShowBreakdown] = React.useState<boolean | null>(null);
  const showBreakdown = open ?? s.breakdown !== "";

  const target = s.mode !== "turnover";
  const breakdown = readBreakdown(s.breakdown);
  const breakdownTotal = breakdown.reduce((sum, v) => sum + (readMoney(v || "0") ?? 0), 0);
  const usingBreakdown = showBreakdown && s.breakdown !== "";

  const overheads = usingBreakdown ? breakdownTotal : readMoney(s.overheads);
  const rate = readNumber(s.rate);
  const marginPct = rate === null ? null : s.basis === "markup" ? markupToMargin(rate) : rate;
  const profit = readMoney(s.profit);
  const turnover = readMoney(s.turnover);
  const job = readMoney(s.job || "0") ?? 0;
  const win = readNumber(s.win || "0") ?? 0;
  const weeks = readNumber(s.weeks || "46") ?? 46;

  const ready = overheads !== null && marginPct !== null && marginPct > 0 && marginPct < 100;
  const base = ready ? { overheadsPence: overheads!, marginPct: marginPct!, averageJobPence: job, winRatePct: win, weeks } : null;
  const plan: ProfitPlan | null = base ? (target ? (profit !== null ? turnoverForProfit({ ...base, profitPence: profit }) : null) : turnover !== null ? profitForTurnover(base, turnover) : null) : null;
  const sensitivity = base && plan && target ? marginSensitivity({ ...base, profitPence: plan.profitPence }) : [];

  const setBreakdown = (i: number, v: string) => {
    const next = [...breakdown];
    next[i] = v;
    set("breakdown", next.join("~"));
  };

  return (
    <div className="flex flex-col gap-6">
      <CalculatorShell
        inputs={
          <>
            <Segmented
              label="What do you want to work out?"
              value={target ? "target" : "turnover"}
              onChange={(v) => set("mode", v)}
              options={[
                { value: "target", label: "Turnover I need", sub: "for the profit I want" },
                { value: "turnover", label: "Profit I'll make", sub: "from my turnover" },
              ]}
            />
            {target ? (
              <Field label="Profit you want a year" htmlFor="rp-profit" hint="Before tax. If you take a salary, put it in overheads; if you live off the profit, put what you need to live on here.">
                <MoneyInput id="rp-profit" value={s.profit} onChange={(v) => set("profit", v)} invalid={s.profit !== "" && profit === null} />
              </Field>
            ) : (
              <Field label="Your turnover a year" htmlFor="rp-turnover" hint="Everything you invoice in a year, before VAT.">
                <MoneyInput id="rp-turnover" value={s.turnover} onChange={(v) => set("turnover", v)} invalid={s.turnover !== "" && turnover === null} />
              </Field>
            )}

            <div className="flex flex-col gap-1.5">
              <Field label="Overheads a year" htmlFor="rp-overheads" hint="What the business costs to run whatever jobs you do: vans, insurance, premises, software, accountant, and your salary if you take one.">
                {usingBreakdown ? (
                  <div className="flex h-12 items-center rounded-xl bg-muted px-3.5 text-[16px] text-ink tabular-nums">{formatGBP(breakdownTotal, 0)}</div>
                ) : (
                  <MoneyInput id="rp-overheads" value={s.overheads} onChange={(v) => set("overheads", v)} invalid={s.overheads !== "" && readMoney(s.overheads) === null} />
                )}
              </Field>
              <button
                type="button"
                aria-expanded={showBreakdown}
                onClick={() => {
                  if (showBreakdown) {
                    // Keep the total they built up as the single figure.
                    merge({ breakdown: "", overheads: usingBreakdown ? String(breakdownTotal / 100) : s.overheads });
                    setShowBreakdown(false);
                  } else {
                    set("breakdown", OVERHEAD_SUGGESTIONS.map((o) => (o.pence ? String(o.pence / 100) : "")).join("~"));
                    setShowBreakdown(true);
                  }
                }}
                className="inline-flex items-center gap-1 self-start text-[13.5px] font-medium text-ink underline underline-offset-2"
              >
                {showBreakdown ? "Use one total instead" : "Not sure? Add them up line by line"}
                <ChevronDown className={cn("size-3.5 transition-transform", showBreakdown && "rotate-180")} />
              </button>
              {showBreakdown && (
                <div className="mt-1 flex flex-col gap-2 rounded-xl bg-muted p-3">
                  {OVERHEAD_SUGGESTIONS.map((o, i) => (
                    <div key={o.label} className="grid grid-cols-[minmax(0,1fr)_132px] items-center gap-2">
                      <label htmlFor={`rp-oh-${i}`} className="text-[13.5px] leading-[1.3] text-ink-2">
                        {o.label}
                      </label>
                      <MoneyInput id={`rp-oh-${i}`} value={breakdown[i] ?? ""} onChange={(v) => setBreakdown(i, v)} invalid={breakdown[i] !== "" && readMoney(breakdown[i] ?? "") === null} />
                    </div>
                  ))}
                  <p className="text-[12.5px] text-subtle">Starting figures are typical for a small firm with one van. Change them to yours.</p>
                </div>
              )}
            </div>

            <Field
              label={s.basis === "markup" ? "Your average markup on jobs" : "Your average gross margin on jobs"}
              htmlFor="rp-rate"
              hint={
                marginPct !== null && marginPct > 0 && marginPct < 100 ? (
                  s.basis === "markup" ? (
                    <>That&apos;s a {pct(marginPct)} gross margin: what&apos;s left of each job&apos;s price after its materials, labour and subcontractors.</>
                  ) : (
                    <>What&apos;s left of each job&apos;s price after its materials, labour and subcontractors. That&apos;s a {pct(marginToMarkup(marginPct))} markup on cost.</>
                  )
                ) : (
                  "Must be more than 0 and a margin must be under 100%."
                )
              }
            >
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                <SuffixInput id="rp-rate" suffix="%" value={s.rate} onChange={(v) => set("rate", v)} invalid={!ready && s.rate !== "" && (rate === null || !(marginPct! > 0 && marginPct! < 100))} />
                <Segmented
                  label="Margin or markup"
                  className="w-[180px]"
                  value={s.basis === "markup" ? "markup" : "margin"}
                  onChange={(v) => {
                    // Convert the figure so the meaning stays the same.
                    if (marginPct !== null && marginPct > 0 && marginPct < 100 && v !== s.basis) merge({ basis: v, rate: String(Number((v === "markup" ? marginToMarkup(marginPct) : marginPct).toFixed(1))) });
                    else set("basis", v);
                  }}
                  options={[
                    { value: "margin", label: "Margin" },
                    { value: "markup", label: "Markup" },
                  ]}
                />
              </div>
            </Field>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Average job" htmlFor="rp-job">
                <MoneyInput id="rp-job" value={s.job} onChange={(v) => set("job", v)} />
              </Field>
              <Field label="Quotes you win" htmlFor="rp-win">
                <SuffixInput id="rp-win" suffix="%" value={s.win} onChange={(v) => set("win", v)} />
              </Field>
              <Field label="Weeks worked" htmlFor="rp-weeks">
                <SuffixInput id="rp-weeks" suffix="a year" value={s.weeks} onChange={(v) => set("weeks", v)} />
              </Field>
            </div>
          </>
        }
        results={plan ? <Results plan={plan} target={target} /> : <Callout tone="warn">Fill in your figures in pounds and percentages to see the results.</Callout>}
      />

      {sensitivity.length > 1 && plan && (
        <div className="overflow-hidden rounded-[24px] bg-white shadow-ring">
          <div className="px-5 pt-5 sm:px-7">
            <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-ink">What a better margin is worth</h2>
            <SensitivityLine rows={sensitivity} />
          </div>
          <div className="mt-3 overflow-x-auto px-2 pb-3 sm:px-4">
            <table className="w-full min-w-[480px] text-[14.5px] tabular-nums">
              <thead>
                <tr className="text-left text-[13px] text-subtle">
                  <th className="px-3 py-2 font-medium">Gross margin</th>
                  <th className="px-3 py-2 font-medium">Turnover needed</th>
                  <th className="px-3 py-2 font-medium">A month</th>
                  {job > 0 && <th className="px-3 py-2 font-medium">Jobs a year</th>}
                  <th className="px-3 py-2 font-medium">Compared with now</th>
                </tr>
              </thead>
              <tbody>
                {sensitivity.map((row) => {
                  const diff = row.plan.turnoverPence - plan.turnoverPence;
                  return (
                    <tr key={row.marginPct} className={cn("border-t border-line", row.current && "bg-brand-soft font-medium")}>
                      <td className="px-3 py-2 text-ink">
                        {pct(row.marginPct)}
                        {row.current && <span className="ml-1.5 text-[12.5px] font-normal text-ink-2">(yours)</span>}
                      </td>
                      <td className="px-3 py-2 text-ink">{formatGBP(row.plan.turnoverPence, 0)}</td>
                      <td className="px-3 py-2 text-ink-2">{formatGBP(row.plan.perMonthPence, 0)}</td>
                      {job > 0 && <td className="px-3 py-2 text-ink-2">{row.plan.jobsPerYear}</td>}
                      <td className={cn("px-3 py-2", diff < 0 ? "text-success" : diff > 0 ? "text-danger" : "text-subtle")}>{diff === 0 ? "n/a" : `${diff < 0 ? "−" : "+"}${formatGBP(Math.abs(diff), 0)}`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function SensitivityLine({ rows }: { rows: ReturnType<typeof marginSensitivity> }) {
  const i = rows.findIndex((r) => r.current);
  const now = rows[i];
  const better = rows[i + 1];
  if (!now || !better) return <p className="mt-1 text-[14px] text-ink-2">The turnover you&apos;d need at different margins.</p>;
  const saved = now.plan.turnoverPence - better.plan.turnoverPence;
  return (
    <p className="mt-1 text-[14px] leading-[1.55] text-ink-2">
      Raising your margin from {pct(now.marginPct)} to {pct(better.marginPct)} means you&apos;d need <strong className="font-semibold text-ink">{formatGBP(saved, 0)} less turnover</strong> (
      {pct((saved / now.plan.turnoverPence) * 100, 0)}) for the same profit: fewer jobs, the same money.
    </p>
  );
}

function Results({ plan, target }: { plan: ProfitPlan; target: boolean }) {
  const loss = plan.profitPence < 0;
  const segments = [
    { label: "Direct job costs", value: plan.directCostsPence, className: "bg-ink-4" },
    { label: "Overheads", value: plan.overheadsPence, className: "bg-ink-2" },
    { label: loss ? "Loss" : "Profit", value: Math.abs(plan.profitPence), className: loss ? "bg-danger" : "bg-brand" },
  ];
  const whole = Math.max(1, plan.directCostsPence + plan.overheadsPence + (loss ? 0 : plan.profitPence));
  return (
    <>
      {target ? (
        <BigResult
          label="Turnover you need a year (before VAT)"
          value={formatGBP(plan.turnoverPence, 0)}
          note={
            <>
              That&apos;s {formatGBP(plan.perMonthPence, 0)} a month, or {formatGBP(plan.perWeekPence, 0)} for each week you work.
            </>
          }
        />
      ) : (
        <BigResult
          label={loss ? "Loss a year (before tax)" : "Profit a year (before tax)"}
          value={formatGBP(Math.abs(plan.profitPence), 0)}
          tone={loss ? "bad" : "good"}
          note={loss ? <>Your gross profit doesn&apos;t cover your overheads.</> : <>A net margin of {pct(plan.netMarginPct)}. That&apos;s {formatGBP(Math.round(plan.profitPence / 12), 0)} a month.</>}
        />
      )}

      <div>
        <div className="flex h-4 overflow-hidden rounded-full bg-line" role="img" aria-label={segments.map((s) => `${s.label} ${formatGBP(s.value, 0)}`).join(", ")}>
          {segments.map((s) => (
            <div key={s.label} className={s.className} style={{ width: `${Math.min(100, (s.value / whole) * 100)}%` }} />
          ))}
        </div>
        <ul className="mt-2.5 grid gap-1.5 text-[13.5px] sm:grid-cols-3">
          {segments.map((s) => (
            <li key={s.label} className="flex items-center gap-2 text-ink-2">
              <span className={cn("size-2.5 flex-none rounded-full", s.className)} />
              <span>
                {s.label} <span className="font-medium text-ink tabular-nums">{formatGBP(s.value, 0)}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <Tile label="Break-even turnover" value={formatGBP(plan.breakEvenPence, 0)} note="Covers overheads, no profit" />
        <Tile label="Net profit margin" value={pct(plan.netMarginPct)} note="Profit as a share of turnover" />
        {plan.jobsPerYear > 0 && <Tile label="Jobs a year" value={String(plan.jobsPerYear)} note={`About ${count(plan.jobsPerMonth)} a month`} />}
        {plan.quotesPerYear > 0 && <Tile label="Quotes to send" value={`${count(plan.quotesPerMonth)} a month`} note={`About ${count(plan.quotesPerWeek)} a week, ${plan.quotesPerYear} a year`} />}
      </div>

      {!target && !loss && plan.turnoverPence > plan.breakEvenPence && (
        <Callout tone="good">You pass break-even at {formatGBP(plan.breakEvenPence, 0)}. Every £1,000 of work after that adds {formatGBP(Math.round(1000_00 * (plan.grossProfitPence / Math.max(1, plan.turnoverPence))), 0)} to your profit.</Callout>
      )}
      {plan.overVatThreshold && (
        <Callout tone="warn">
          <strong className="font-semibold">Over the {formatGBP(VAT_THRESHOLD_PENCE, 0)} VAT threshold.</strong> You&apos;ll need to be VAT registered. Homeowners can&apos;t claim VAT back, so to them
          this turnover costs {formatGBP(Math.round(plan.turnoverPence * 1.2), 0)} including VAT.
        </Callout>
      )}
      <ShareActions />
    </>
  );
}

function Tile({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-xl bg-white p-3.5 shadow-ring">
      <div className="text-[12.5px] font-medium text-ink-2">{label}</div>
      <div className="mt-1 text-[21px] leading-none font-semibold tracking-[-0.02em] text-ink tabular-nums">{value}</div>
      <div className="mt-1.5 text-[12px] leading-[1.35] text-subtle">{note}</div>
    </div>
  );
}
