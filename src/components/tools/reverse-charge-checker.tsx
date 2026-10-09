"use client";

import * as React from "react";
import Link from "next/link";
import { CircleCheck, CircleX, RotateCcw } from "lucide-react";
import { formatGBP } from "@/core/money";
import { DRC_QUESTIONS, DRC_WORDING, answeredQuestions, drcInvoice, drcStep, formatDrcAnswers, parseDrcAnswers, type DrcAnswers, type DrcOutcome } from "@/core/tools/reverse-charge";
import { cn } from "@/lib/utils";
import { BigResult, CalculatorShell, Callout, Field, MoneyInput, readMoney, Rows, ShareActions, useUrlState } from "./controls";

const DEFAULTS = { a: "", net: "10000" };

const TITLE: Record<DrcOutcome["kind"], string> = {
  applies: "Yes, the reverse charge applies",
  normal_vat: "No, charge VAT as normal",
  no_vat: "No, and you don't charge VAT",
  zero_rated: "No, it's zero rated",
};

/** The domestic reverse charge as a few yes/no questions, with the invoice it leads to. */
export function ReverseChargeChecker() {
  const [s, set] = useUrlState(DEFAULTS);
  const answers = parseDrcAnswers(s.a);
  const step = drcStep(answers);
  const answered = answeredQuestions(answers);
  const net = readMoney(s.net);

  const answer = (id: keyof DrcAnswers, value: string) => {
    // Answering (or changing) a question clears everything after it.
    const kept: DrcAnswers = {};
    for (const q of DRC_QUESTIONS) {
      if (q.id === id) break;
      if (answers[q.id] !== undefined) (kept as Record<string, string>)[q.id] = answers[q.id]!;
    }
    (kept as Record<string, string>)[id] = value;
    set("a", formatDrcAnswers(kept));
  };

  // Go back to a question: forget its answer and everything after it.
  const changeFrom = (id: keyof DrcAnswers) => {
    const kept: DrcAnswers = {};
    for (const q of DRC_QUESTIONS) {
      if (q.id === id) break;
      if (answers[q.id] !== undefined) (kept as Record<string, string>)[q.id] = answers[q.id]!;
    }
    set("a", formatDrcAnswers(kept));
  };

  const outcome = "outcome" in step ? step.outcome : null;
  const invoice = outcome && net !== null ? drcInvoice(net, outcome, answers.rate) : null;

  return (
    <CalculatorShell
      inputs={
        <>
          <ol className="flex flex-col gap-2">
            {answered.map((q, i) => (
              <li key={q.id} className="flex items-start justify-between gap-3 rounded-xl bg-muted px-3.5 py-2.5 text-[14px]">
                <span className="text-ink-2">
                  <span className="mr-1.5 text-subtle tabular-nums">{i + 1}.</span>
                  {q.question}
                </span>
                <span className="flex flex-none items-center gap-2">
                  <span className="font-medium text-ink">{q.options.find((o) => o.value === answers[q.id])?.label}</span>
                  <button type="button" onClick={() => changeFrom(q.id)} className="text-[12.5px] text-subtle underline underline-offset-2 hover:text-ink" aria-label={`Change your answer to: ${q.question}`}>
                    Change
                  </button>
                </span>
              </li>
            ))}
          </ol>

          {"next" in step && (
            <div className="rounded-2xl p-1">
              <div className="text-[13px] font-medium text-subtle">
                Question {answered.length + 1} of up to {DRC_QUESTIONS.length}
              </div>
              <h3 className="mt-1.5 text-[19px] leading-[1.3] font-semibold tracking-[-0.01em] text-ink">{step.next.question}</h3>
              <p className="mt-2 text-[14px] leading-[1.55] text-ink-2">{step.next.help}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {step.next.options.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => answer(step.next.id, o.value)}
                    className="h-11 min-w-[96px] rounded-xl bg-ink px-5 text-[15px] font-medium text-white hover:bg-ink-2"
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {answered.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => changeFrom(answered[answered.length - 1]!.id)}
                className="inline-flex h-9 items-center rounded-lg px-3 text-[13.5px] font-medium text-ink-2 shadow-ring hover:text-ink"
              >
                Back a step
              </button>
              <button type="button" onClick={() => set("a", "")} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13.5px] font-medium text-ink-2 shadow-ring hover:text-ink">
                <RotateCcw className="size-3.5" />
                Start again
              </button>
            </div>
          )}

          <Field label="Invoice amount before VAT (optional)" htmlFor="drc-net" hint="To see what the invoice looks like.">
            <MoneyInput id="drc-net" value={s.net} onChange={(v) => set("net", v)} invalid={s.net !== "" && net === null} />
          </Field>
        </>
      }
      results={
        outcome ? (
          <>
            <div className={cn("flex items-start gap-3 rounded-2xl p-4", outcome.kind === "applies" ? "bg-brand-soft" : "bg-success-soft")}>
              {outcome.kind === "applies" ? <CircleCheck className="mt-0.5 size-6 flex-none text-brand" /> : <CircleX className="mt-0.5 size-6 flex-none text-success" />}
              <div>
                <div className="text-[19px] leading-[1.3] font-semibold tracking-[-0.01em] text-ink" aria-live="polite">
                  {TITLE[outcome.kind]}
                </div>
                <p className="mt-1.5 text-[14.5px] leading-[1.55] text-ink-2">{outcome.reason}</p>
              </div>
            </div>
            {invoice && (
              <>
                <BigResult
                  label={outcome.kind === "applies" ? "Your customer pays you" : "Invoice total"}
                  value={formatGBP(invoice.customerPaysPence)}
                  note={outcome.kind === "applies" ? <>Your customer pays the {formatGBP(invoice.vatPence)} VAT to HMRC instead of to you.</> : undefined}
                />
                <Rows
                  rows={[
                    { label: "Net amount", value: formatGBP(invoice.netPence) },
                    outcome.kind === "applies"
                      ? { label: `VAT at ${invoice.vatRateBps / 100}% (shown, not charged)`, value: formatGBP(invoice.vatPence), muted: true }
                      : outcome.kind === "no_vat"
                        ? { label: "VAT", value: "None" }
                        : { label: `VAT at ${invoice.vatRateBps / 100}%`, value: formatGBP(invoice.vatPence) },
                    { label: "Amount due", value: formatGBP(invoice.customerPaysPence), strong: true },
                  ]}
                />
              </>
            )}
            {outcome.kind === "applies" && (
              <div>
                <div className="text-[14px] font-medium text-ink">Put this on your invoice</div>
                <div className="mt-2 rounded-xl bg-white px-4 py-3 font-mono text-[14px] text-ink shadow-ring select-all">{DRC_WORDING}</div>
                <p className="mt-2 text-[13px] leading-[1.5] text-subtle">
                  Show the VAT rate and the amount of VAT too, as above. Don&apos;t add the VAT to the total, and don&apos;t include it in the output VAT on your own return.
                </p>
              </div>
            )}
            {outcome.kind === "applies" && (
              <Callout>
                Paying a subcontractor under CIS as well? Work out the deduction with our <Link href="/tools/cis-calculator" className="font-medium text-ink underline underline-offset-2">CIS calculator</Link>.
              </Callout>
            )}
            <ShareActions />
          </>
        ) : (
          <div className="flex flex-1 flex-col justify-center gap-3">
            <div className="text-[19px] font-semibold tracking-[-0.01em] text-ink">Answer the questions to get your answer</div>
            <p className="text-[14.5px] leading-[1.55] text-ink-2">
              It takes six questions at most. You&apos;ll see whether the reverse charge applies, why, and exactly what your invoice should say.
            </p>
            <ol className="mt-1 flex flex-col gap-1.5 text-[14px] text-subtle">
              {DRC_QUESTIONS.map((q, i) => (
                <li key={q.id} className={cn(i < answered.length && "text-ink-2 line-through decoration-faint")}>
                  {i + 1}. {q.question}
                </li>
              ))}
            </ol>
          </div>
        )
      }
    />
  );
}
