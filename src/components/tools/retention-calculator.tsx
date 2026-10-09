"use client";

import { formatGBP } from "@/core/money";
import { longDay } from "@/core/tools/dates";
import { retentionForJob, retentionForYear } from "@/core/tools/retention";
import { BigResult, CalculatorShell, Callout, DateInput, Field, MoneyInput, readMoney, readNumber, Rows, Segmented, ShareActions, SuffixInput, useUrlState } from "./controls";

const DEFAULTS = { mode: "job", amount: "200000", pct: "5", first: "50", build: "6", defects: "12", delay: "30", rate: "8", done: "" };

const months = (days: number) => {
  const m = days / (365 / 12);
  return m >= 1.5 ? `${Math.round(m)} months` : `${Math.round(days)} days`;
};

/** Retention money on one job or across a year of work: how much, when it comes back, what waiting costs. */
export function RetentionCalculator() {
  const [s, set] = useUrlState(DEFAULTS);
  const year = s.mode === "year";
  const amount = readMoney(s.amount);
  const pct = readNumber(s.pct);
  const first = readNumber(s.first);
  const build = readNumber(s.build || "0") ?? 0;
  const defects = readNumber(s.defects || "0") ?? 0;
  const delay = readNumber(s.delay || "0") ?? 0;
  const rate = readNumber(s.rate || "0") ?? 0;
  const ok = amount !== null && pct !== null && first !== null;
  const base = { retentionPct: pct ?? 0, firstReleasePct: first ?? 0, buildMonths: build, defectsMonths: defects, delayDays: delay, borrowingPct: rate };
  const job = ok && !year ? retentionForJob({ ...base, contractPence: amount!, completion: s.done || undefined }) : null;
  const yr = ok && year ? retentionForYear(amount!, base) : null;

  return (
    <CalculatorShell
      inputs={
        <>
          <Segmented
            label="One job or a year of work?"
            value={year ? "year" : "job"}
            onChange={(v) => set("mode", v)}
            options={[
              { value: "job", label: "One job" },
              { value: "year", label: "A year of work" },
            ]}
          />
          <Field label={year ? "Work a year with retention on it" : "Contract value"} htmlFor="rt-amount" hint={year ? "The turnover you invoice a year on contracts that hold back retention, before VAT." : "Before VAT."}>
            <MoneyInput id="rt-amount" value={s.amount} onChange={(v) => set("amount", v)} invalid={s.amount !== "" && amount === null} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Retention" htmlFor="rt-pct" hint="Usually 3% to 5%.">
              <SuffixInput id="rt-pct" suffix="%" value={s.pct} onChange={(v) => set("pct", v)} invalid={s.pct !== "" && (pct === null || pct > 100)} />
            </Field>
            <Field label="Released at completion" htmlFor="rt-first" hint="Usually half; the rest after the defects period.">
              <SuffixInput id="rt-first" suffix="%" value={s.first} onChange={(v) => set("first", v)} invalid={s.first !== "" && (first === null || first > 100)} />
            </Field>
            <Field label={year ? "Average job length" : "Build length"} htmlFor="rt-build">
              <SuffixInput id="rt-build" suffix="months" value={s.build} onChange={(v) => set("build", v)} />
            </Field>
            <Field label="Defects period" htmlFor="rt-defects">
              <SuffixInput id="rt-defects" suffix="months" value={s.defects} onChange={(v) => set("defects", v)} />
            </Field>
            <Field label="Usually paid late by" htmlFor="rt-delay" hint="Retention is often released well after it's due.">
              <SuffixInput id="rt-delay" suffix="days" value={s.delay} onChange={(v) => set("delay", v)} />
            </Field>
            <Field label="Your borrowing rate" htmlFor="rt-rate" hint="Overdraft or loan, a year.">
              <SuffixInput id="rt-rate" suffix="%" value={s.rate} onChange={(v) => set("rate", v)} />
            </Field>
          </div>
          {!year && (
            <Field label="Expected practical completion (optional)" htmlFor="rt-done" hint="To see the dates the money should come back.">
              <DateInput id="rt-done" value={s.done} onChange={(v) => set("done", v)} />
            </Field>
          )}
        </>
      }
      results={
        job ? (
          <>
            <BigResult label="Held back on this job" value={formatGBP(job.retentionPence, 0)} note={<>Waiting for it costs about {formatGBP(job.costPence, 0)} at {rate}% a year.</>} />
            <Rows
              rows={[
                { label: job.firstReleaseDate ? `At completion, by ${longDay(job.firstReleaseDate)}` : "Released at completion", value: formatGBP(job.firstReleasePence, 0) },
                { label: job.secondReleaseDate ? `After the defects period, by ${longDay(job.secondReleaseDate)}` : "After the defects period", value: formatGBP(job.secondReleasePence, 0) },
                { label: "Average time the first part is held", value: months(job.firstHeldDays), muted: true },
                { label: "Average time the second part is held", value: months(job.secondHeldDays), muted: true },
                { label: "Cost of waiting", value: formatGBP(job.costPence, 0), strong: true },
              ]}
            />
            <Callout tone="warn">
              On a job making a typical 10% profit, that retention is <strong className="font-semibold">{Math.round((job.retentionPence / (amount! * 0.1)) * 100)}% of your profit</strong>, left with someone else
              until {job.secondReleaseDate ? longDay(job.secondReleaseDate) : `${months(job.secondHeldDays)} after the work starts`}. If they go bust first, it&apos;s usually gone.
            </Callout>
            <ShareActions />
          </>
        ) : yr ? (
          <>
            <BigResult label="Tied up in retentions at any time" value={formatGBP(yr.averageHeldPence, 0)} note={<>On average, across the year. That costs about {formatGBP(yr.yearlyCostPence, 0)} a year at {rate}%.</>} />
            <Rows
              rows={[
                { label: "Held back from a year's invoices", value: formatGBP(yr.heldEachYearPence, 0) },
                { label: "Average held at any one time", value: formatGBP(yr.averageHeldPence, 0), strong: true },
                { label: "Yearly cost of the money", value: formatGBP(yr.yearlyCostPence, 0) },
              ]}
            />
            <Callout>
              That&apos;s cash you&apos;ve earned that you can&apos;t use for wages, materials or the next job. A ban on cash retentions is going through Parliament in the Commercial Payments Bill.
            </Callout>
            <ShareActions />
          </>
        ) : (
          <Callout tone="warn">Enter the amount in pounds and the percentages as numbers, like 5.</Callout>
        )
      }
    />
  );
}
