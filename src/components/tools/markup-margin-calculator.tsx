"use client";

import { formatGBP } from "@/core/money";
import { REFERENCE_MARKUPS, marginToMarkup, markupToMargin, mixUpCost, pct, priceFrom, type PriceMode } from "@/core/tools/margin";
import { cn } from "@/lib/utils";
import { BigResult, CalculatorShell, Callout, Field, MoneyInput, readMoney, readNumber, Rows, Segmented, ShareActions, SuffixInput, useUrlState } from "./controls";

const DEFAULTS = { cost: "10000", mode: "markup", value: "25", price: "12500" };

const MODES: { value: PriceMode; label: string }[] = [
  { value: "markup", label: "Markup %" },
  { value: "margin", label: "Margin %" },
  { value: "price", label: "Selling price" },
];

/** Markup and margin from a cost and any one of: markup, margin or price. */
export function MarkupMarginCalculator() {
  const [s, set] = useUrlState(DEFAULTS);
  const mode = (MODES.some((m) => m.value === s.mode) ? s.mode : "markup") as PriceMode;
  const cost = readMoney(s.cost);
  const value = mode === "price" ? readMoney(s.price) : readNumber(s.value);
  const r = cost !== null && value !== null ? priceFrom(cost, mode, value) : null;
  const marginTooHigh = mode === "margin" && value !== null && value >= 100;

  // The mix-up, told from whichever side the user typed.
  const typedPct = mode === "price" || !r ? null : value;
  const mix = typedPct !== null && cost !== null ? mixUpCost(cost, typedPct) : null;

  return (
    <div className="flex flex-col gap-6">
      <CalculatorShell
        inputs={
          <>
            <Field label="Your cost" htmlFor="mm-cost" hint="Everything the job costs you: materials, labour, subcontractors, hire.">
              <MoneyInput id="mm-cost" value={s.cost} onChange={(v) => set("cost", v)} invalid={s.cost !== "" && cost === null} />
            </Field>
            <Field label="What do you know?">
              <Segmented label="What do you know?" value={mode} onChange={(v) => set("mode", v)} options={MODES} />
            </Field>
            {mode === "price" ? (
              <Field label="Selling price" htmlFor="mm-price" hint="What you charge the client, before VAT.">
                <MoneyInput id="mm-price" value={s.price} onChange={(v) => set("price", v)} invalid={s.price !== "" && value === null} />
              </Field>
            ) : (
              <Field
                label={mode === "markup" ? "Markup" : "Margin"}
                htmlFor="mm-value"
                hint={mode === "markup" ? "Profit as a percentage of your cost." : "Profit as a percentage of the selling price. Must be under 100%."}
              >
                <SuffixInput id="mm-value" suffix="%" value={s.value} onChange={(v) => set("value", v)} invalid={(s.value !== "" && value === null) || marginTooHigh} />
              </Field>
            )}
          </>
        }
        results={
          r ? (
            <>
              <BigResult label="Selling price (before VAT)" value={formatGBP(r.pricePence)} note={<>{formatGBP(r.pricePence + Math.round(r.pricePence * 0.2))} with VAT at 20%.</>} tone={r.profitPence < 0 ? "bad" : undefined} />
              <div>
                <div className="flex h-3 overflow-hidden rounded-full bg-line" aria-hidden>
                  <div className="bg-ink-4" style={{ width: `${Math.min(100, (r.costPence / r.pricePence) * 100)}%` }} />
                  <div className="bg-brand" style={{ width: `${Math.max(0, (r.profitPence / r.pricePence) * 100)}%` }} />
                </div>
                <div className="mt-1.5 flex justify-between text-[12.5px] text-subtle">
                  <span>Cost {pct((r.costPence / r.pricePence) * 100, 0)} of the price</span>
                  <span>Profit {pct(r.marginPct, 0)}</span>
                </div>
              </div>
              <Rows
                rows={[
                  { label: "Cost", value: formatGBP(r.costPence) },
                  { label: "Profit", value: formatGBP(r.profitPence), strong: true },
                  { label: "Markup (profit ÷ cost)", value: pct(r.markupPct) },
                  { label: "Margin (profit ÷ price)", value: pct(r.marginPct) },
                ]}
              />
              {mix && mix.shortfallPence > 0 && (
                <Callout tone="warn">
                  {mode === "markup" ? (
                    <>
                      A {pct(typedPct!)} markup is only a <strong>{pct(mix.actualMarginPct)} margin</strong>. If you meant a {pct(typedPct!)} margin, charge {formatGBP(mix.wantedPricePence)}:{" "}
                      {formatGBP(mix.shortfallPence)} more on this job.
                    </>
                  ) : (
                    <>
                      A {pct(typedPct!)} margin needs a <strong>{pct(marginToMarkup(typedPct!))} markup</strong>. Add only {pct(typedPct!)} to your cost and you&apos;d charge{" "}
                      {formatGBP(mix.chargedPricePence)}, {formatGBP(mix.shortfallPence)} short, making a {pct(mix.actualMarginPct)} margin.
                    </>
                  )}
                </Callout>
              )}
              <ShareActions />
            </>
          ) : (
            <Callout tone="warn">{marginTooHigh ? "A margin has to be under 100%: it's a share of the price, so it can never be all of it." : "Enter your cost and a markup, margin or price."}</Callout>
          )
        }
      />

      <div className="overflow-hidden rounded-[24px] bg-white shadow-ring print:hidden">
        <div className="px-5 pt-5 sm:px-7">
          <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-ink">Markup to margin, at a glance</h2>
          <p className="mt-1 text-[14px] text-ink-2">The same profit, described two ways. Your figure is highlighted.</p>
        </div>
        <div className="mt-3 overflow-x-auto px-2 pb-3 sm:px-4">
          <table className="w-full min-w-[420px] text-[14.5px] tabular-nums">
            <thead>
              <tr className="text-left text-[13px] text-subtle">
                <th className="px-3 py-2 font-medium">Markup</th>
                <th className="px-3 py-2 font-medium">Margin</th>
                <th className="px-3 py-2 font-medium">£1,000 cost sells for</th>
                <th className="px-3 py-2 font-medium">Profit</th>
              </tr>
            </thead>
            <tbody>
              {REFERENCE_MARKUPS.map((m) => {
                const on = r !== null && Math.abs(r.markupPct - m) < 0.5;
                const price = Math.round(100_000 * (1 + m / 100));
                return (
                  <tr key={m} className={cn("border-t border-line", on && "bg-brand-soft")}>
                    <td className="px-3 py-2 font-medium text-ink">{pct(m)}</td>
                    <td className="px-3 py-2 text-ink-2">{pct(markupToMargin(m))}</td>
                    <td className="px-3 py-2 text-ink-2">{formatGBP(price, 0)}</td>
                    <td className="px-3 py-2 text-ink-2">{formatGBP(price - 100_000, 0)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
