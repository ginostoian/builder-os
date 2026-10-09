"use client";

import { formatGBP } from "@/core/money";
import { dayRate } from "@/core/tools/day-rate";
import { BigResult, CalculatorShell, Callout, Field, MoneyInput, readMoney, readNumber, Rows, Segmented, ShareActions, SuffixInput, useUrlState } from "./controls";

const DEFAULTS = { basis: "before_tax", income: "45000", costs: "15000", days: "5", holiday: "4", bank: "8", lost: "10", admin: "0.5", hours: "8", vat: "no" };

/** The day rate you need: income and costs spread over the days you can actually bill. */
export function DayRateCalculator() {
  const [s, set] = useUrlState(DEFAULTS);
  const takeHome = s.basis === "take_home";
  const income = readMoney(s.income);
  const costs = readMoney(s.costs || "0");
  const num = (v: string, fallback: number) => readNumber(v) ?? fallback;
  const r =
    income !== null && costs !== null
      ? dayRate({
          incomePence: income,
          basis: takeHome ? "take_home" : "before_tax",
          costsPence: costs,
          daysPerWeek: num(s.days, 5),
          holidayWeeks: num(s.holiday, 0),
          bankHolidays: num(s.bank, 0),
          lostDays: num(s.lost, 0),
          adminDaysPerWeek: num(s.admin, 0),
          hoursPerDay: num(s.hours, 8),
        })
      : null;
  const vat = s.vat === "yes";
  const shortfall = r ? (r.dayRatePence - r.naiveDayRatePence) * r.billableDays : 0;

  return (
    <CalculatorShell
      inputs={
        <>
          <Field label="What you want to earn a year" htmlFor="dr-income" hint={takeHome ? "In your pocket after income tax and National Insurance." : "Your profit before tax: what you'd pay yourself."}>
            <MoneyInput id="dr-income" value={s.income} onChange={(v) => set("income", v)} invalid={s.income !== "" && income === null} />
          </Field>
          <Segmented
            label="Before or after tax?"
            value={takeHome ? "take_home" : "before_tax"}
            onChange={(v) => set("basis", v)}
            options={[
              { value: "before_tax", label: "Before tax" },
              { value: "take_home", label: "Take-home", sub: "after tax and NI" },
            ]}
          />
          <Field label="Business costs a year" htmlFor="dr-costs" hint="Van, fuel, tools, insurance, phone, software, accountant, training. Not materials you charge to jobs.">
            <MoneyInput id="dr-costs" value={s.costs} onChange={(v) => set("costs", v)} invalid={s.costs !== "" && costs === null} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Days a week" htmlFor="dr-days">
              <SuffixInput id="dr-days" suffix="days" value={s.days} onChange={(v) => set("days", v)} />
            </Field>
            <Field label="Holiday" htmlFor="dr-holiday">
              <SuffixInput id="dr-holiday" suffix="weeks" value={s.holiday} onChange={(v) => set("holiday", v)} />
            </Field>
            <Field label="Bank holidays" htmlFor="dr-bank">
              <SuffixInput id="dr-bank" suffix="days" value={s.bank} onChange={(v) => set("bank", v)} />
            </Field>
            <Field label="Sick, weather, gaps" htmlFor="dr-lost" hint="Days a year you can't work.">
              <SuffixInput id="dr-lost" suffix="days" value={s.lost} onChange={(v) => set("lost", v)} />
            </Field>
            <Field label="Unpaid admin" htmlFor="dr-admin" hint="Quoting, buying, paperwork.">
              <SuffixInput id="dr-admin" suffix="days a week" value={s.admin} onChange={(v) => set("admin", v)} />
            </Field>
            <Field label="Hours in a day" htmlFor="dr-hours">
              <SuffixInput id="dr-hours" suffix="hours" value={s.hours} onChange={(v) => set("hours", v)} />
            </Field>
          </div>
          <Field label="Are you VAT registered?">
            <Segmented
              label="Are you VAT registered?"
              value={vat ? "yes" : "no"}
              onChange={(v) => set("vat", v)}
              options={[
                { value: "no", label: "No" },
                { value: "yes", label: "Yes", sub: "add 20% for homeowners" },
              ]}
            />
          </Field>
        </>
      }
      results={
        r ? (
          <>
            <BigResult
              label="Your day rate"
              value={formatGBP(r.dayRatePence, 0)}
              note={
                <>
                  {formatGBP(r.hourlyPence)} an hour · {formatGBP(r.halfDayPence, 0)} a half day · {formatGBP(r.weeklyPence, 0)} a week{vat ? <>. {formatGBP(Math.round(r.dayRatePence * 1.2), 0)} a day with VAT.</> : "."}
                </>
              }
            />
            <Rows
              rows={[
                { label: "Days you can bill a year", value: `${r.billableDays}` },
                { label: "Turnover needed", value: formatGBP(r.turnoverPence, 0) },
                { label: "Business costs", value: `−${formatGBP(r.turnoverPence - r.profitPence, 0)}` },
                { label: "Profit before tax", value: formatGBP(r.profitPence, 0), strong: true },
                { label: "Income tax (estimate)", value: `−${formatGBP(r.incomeTaxPence, 0)}` },
                { label: "National Insurance (estimate)", value: `−${formatGBP(r.niPence, 0)}` },
                { label: "Take-home a year", value: formatGBP(r.takeHomePence, 0), strong: true },
              ]}
            />
            {shortfall > 0 && (
              <Callout tone="warn">
                Dividing {formatGBP(r.profitPence, 0)} by 260 working days suggests {formatGBP(r.naiveDayRatePence, 0)} a day. Charge that and, after the days you can&apos;t bill and your costs,
                you&apos;d be about <strong className="font-semibold">{formatGBP(shortfall, 0)} a year short</strong>.
              </Callout>
            )}
            <p className="text-[12.5px] leading-[1.5] text-subtle">Tax is a rough guide for a sole trader in England, Wales or Northern Ireland with no other income, at 2026/27 rates. Limited companies and Scotland differ.</p>
            <ShareActions />
          </>
        ) : (
          <Callout tone="warn">Enter what you want to earn and check the days add up to some billable days.</Callout>
        )
      }
    />
  );
}
