"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, CalendarDays, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { TEXT } from "@/core/limits";
import { formatBps, formatGBP, parsePence, parsePercentToBps } from "@/core/money";
import { MAX_PAYMENT_STAGES, addDays, computePlan, ukToday, weeklyInstalments, type AmountKind, type DueKind, type PlanStage } from "@/core/payment-plan";
import { cn } from "@/lib/utils";
import { Field, control } from "../form-fields";

const uuid = () => crypto.randomUUID();
const pct = (bps: number) => String(Number((bps / 100).toFixed(2)));
const pounds = (pence: number) => (pence / 100).toFixed(2);

const DUE_LABEL: Record<DueKind, string> = { on_acceptance: "On acceptance", date: "On a date", milestone: "At a stage of work" };

const PRESETS: { label: string; hint: string; plan: () => PlanStage[] }[] = [
  {
    label: "Deposit and balance",
    hint: "25% to book, the rest on completion",
    plan: () => [
      { id: uuid(), label: "Deposit", amountKind: "percent", amountValue: 2500, dueKind: "on_acceptance" },
      { id: uuid(), label: "Balance on completion", amountKind: "balance", dueKind: "milestone" },
    ],
  },
  {
    label: "Three stages",
    hint: "30% deposit, 40% at first fix, balance on completion",
    plan: () => [
      { id: uuid(), label: "Deposit", amountKind: "percent", amountValue: 3000, dueKind: "on_acceptance" },
      { id: uuid(), label: "First fix complete", amountKind: "percent", amountValue: 4000, dueKind: "milestone" },
      { id: uuid(), label: "Balance on completion", amountKind: "balance", dueKind: "milestone" },
    ],
  },
];

/**
 * The quote's payment plan: stages as a percentage, a fixed amount or the remaining balance, each due on
 * acceptance, on a date or at a stage of the work. Amounts update live against the quote total, and the
 * client sees the plan on the quote. Saving happens through `onChange` (only valid plans are saved).
 */
export function PaymentPlanEditor({ plan, total, disabled, onChange }: { plan: PlanStage[]; total: number; disabled: boolean; onChange: (plan: PlanStage[]) => void }) {
  const result = computePlan(plan, total);
  const amounts = new Map(result.stages.map((s) => [s.id, s.amount]));
  const update = (id: string, patch: Partial<PlanStage>) => onChange(plan.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= plan.length) return;
    const next = [...plan];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const changeKind = (s: PlanStage, kind: AmountKind) => {
    const current = amounts.get(s.id) ?? 0;
    if (kind === "balance") return update(s.id, { amountKind: kind, amountValue: undefined });
    if (kind === "fixed") return update(s.id, { amountKind: kind, amountValue: Math.max(0, current) });
    update(s.id, { amountKind: kind, amountValue: total > 0 ? Math.min(10_000, Math.max(0, Math.round((current / total) * 10_000))) : 0 });
  };
  const hasBalance = plan.some((s) => s.amountKind === "balance");

  return (
    <fieldset disabled={disabled} className="min-h-0 flex-1 overflow-auto bg-surface-2 p-6">
      <div className="flex max-w-[940px] flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[13.5px] font-semibold">How the client pays</h2>
            <p className="max-w-[520px] text-subtle">
              Shown on the quote, and each payment becomes an invoice with one click once it&apos;s accepted. Clients pay by bank transfer, or online if you take payments online.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <Button key={p.label} variant="secondary" title={p.hint} onClick={() => onChange(p.plan())}>
                {p.label}
              </Button>
            ))}
            <WeeklyDialog total={total} onApply={onChange} />
          </div>
        </div>

        {plan.length === 0 ? (
          <div className="rounded-[10px] bg-white px-4 py-6 text-center shadow-ring">
            <p className="font-medium">No payment plan yet</p>
            <p className="mt-1 text-subtle">Without one, the quote asks for the full {formatGBP(total)} on completion. Pick a preset above or add payments.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-[10px] bg-white shadow-ring">
            <div className="grid min-w-[860px] grid-cols-[minmax(0,1fr)_150px_104px_244px_104px_76px] items-center gap-2 border-b border-hairline bg-surface-2 px-3 py-2 text-[11.5px] font-medium text-subtle">
              <span>Payment</span>
              <span>Amount as</span>
              <span>Value</span>
              <span>Due</span>
              <span className="text-right">Amount</span>
              <span />
            </div>
            <ol>
              {plan.map((s, i) => (
                <li key={s.id} className="grid min-w-[860px] grid-cols-[minmax(0,1fr)_150px_104px_244px_104px_76px] items-center gap-2 border-b border-hairline px-3 py-2 last:border-b-0">
                  <LabelInput value={s.label} onCommit={(label) => update(s.id, { label })} />
                  <select aria-label="Amount as" value={s.amountKind} onChange={(e) => changeKind(s, e.target.value as AmountKind)} className={control}>
                    <option value="percent">% of total</option>
                    <option value="fixed">Fixed £</option>
                    <option value="balance" disabled={hasBalance && s.amountKind !== "balance"}>
                      Remaining balance
                    </option>
                  </select>
                  {s.amountKind === "balance" ? (
                    <span className="px-2.5 text-[12.5px] text-subtle">The rest</span>
                  ) : (
                    <ValueInput key={`${s.id}-${s.amountKind}`} kind={s.amountKind} value={s.amountValue ?? 0} onCommit={(amountValue) => update(s.id, { amountValue })} />
                  )}
                  <div className="flex gap-1.5">
                    <select
                      aria-label="Due"
                      value={s.dueKind}
                      onChange={(e) => {
                        const dueKind = e.target.value as DueKind;
                        update(s.id, { dueKind, dueDate: dueKind === "date" ? (s.dueDate ?? addDays(ukToday(), 7)) : undefined });
                      }}
                      className={cn(control, s.dueKind === "date" && "w-[104px] flex-none")}
                    >
                      {(Object.keys(DUE_LABEL) as DueKind[]).map((k) => (
                        <option key={k} value={k}>
                          {DUE_LABEL[k]}
                        </option>
                      ))}
                    </select>
                    {s.dueKind === "date" && (
                      <input type="date" aria-label="Due date" value={s.dueDate ?? ""} onChange={(e) => e.target.value && update(s.id, { dueDate: e.target.value })} className={cn(control, "px-1.5 text-[12px]")} />
                    )}
                  </div>
                  <span className={cn("text-right font-medium tabular", (amounts.get(s.id) ?? 0) < 0 && "text-danger")}>{formatGBP(amounts.get(s.id) ?? 0)}</span>
                  <div className="flex justify-end gap-0.5">
                    <IconButton label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                      <ArrowUp />
                    </IconButton>
                    <IconButton label="Move down" disabled={i === plan.length - 1} onClick={() => move(i, 1)}>
                      <ArrowDown />
                    </IconButton>
                    <IconButton label="Remove payment" onClick={() => onChange(plan.filter((x) => x.id !== s.id))}>
                      <Trash2 />
                    </IconButton>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            variant="secondary"
            disabled={plan.length >= MAX_PAYMENT_STAGES}
            onClick={() => onChange([...plan, { id: uuid(), label: `Payment ${plan.length + 1}`, amountKind: hasBalance ? "percent" : "balance", amountValue: hasBalance ? 0 : undefined, dueKind: "milestone" }])}
          >
            <Plus />
            Add payment
          </Button>
          {plan.length > 0 && (
            <div className="flex items-center gap-4 tabular">
              <span className="text-subtle">
                {plan.length} payment{plan.length === 1 ? "" : "s"}
              </span>
              <span>
                Total <span className="font-semibold">{formatGBP(result.stages.reduce((a, s) => a + s.amount, 0))}</span> of {formatGBP(total)}
              </span>
            </div>
          )}
        </div>
        {!result.ok && plan.length > 0 && (
          <p role="alert" className="rounded-lg bg-warning-soft px-3.5 py-2.5 text-warning">
            {result.error} The quote can&apos;t be sent until the payments add up to the total.
          </p>
        )}
        <p className="text-[12px] text-subtle">
          &ldquo;On a date&rdquo; payments are invoiced for that date. Payments at a stage of work are invoiced when you raise them, due after your payment terms (Settings → Payments).
        </p>
      </div>
    </fieldset>
  );
}

function IconButton({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className="grid size-7 place-items-center rounded-md text-subtle hover:bg-muted hover:text-ink disabled:opacity-30 [&_svg]:size-3.5">
      {children}
    </button>
  );
}

function LabelInput({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  const [text, setText] = React.useState(value);
  return (
    <input
      aria-label="Payment name"
      value={text}
      maxLength={TEXT.name}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        const t = text.trim();
        if (t && t !== value) onCommit(t);
        else setText(value);
      }}
      className={control}
    />
  );
}

function ValueInput({ kind, value, onCommit }: { kind: "percent" | "fixed"; value: number; onCommit: (v: number) => void }) {
  const show = (v: number) => (kind === "percent" ? pct(v) : pounds(v));
  const [text, setText] = React.useState(show(value));
  const [bad, setBad] = React.useState(false);
  return (
    <div className="relative">
      {kind === "fixed" && <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-subtle">£</span>}
      <input
        aria-label={kind === "percent" ? "Percentage of the total" : "Amount in pounds"}
        value={text}
        inputMode="decimal"
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const v = kind === "percent" ? parsePercentToBps(text, 10_000) : parsePence(text);
          setBad(v === null || v < 0);
          if (v !== null && v >= 0) {
            setText(show(v));
            if (v !== value) onCommit(v);
          }
        }}
        className={cn(control, "text-right tabular", kind === "fixed" ? "pl-6" : "pr-7", bad && "shadow-[0_0_0_1.5px_var(--color-danger)]")}
      />
      {kind === "percent" && <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-subtle">%</span>}
    </div>
  );
}

/** Generate a deposit (optional) plus N weekly instalments for the rest, starting on a date. */
function WeeklyDialog({ total, onApply }: { total: number; onApply: (plan: PlanStage[]) => void }) {
  const [open, setOpen] = React.useState(false);
  const [deposit, setDeposit] = React.useState("20");
  const [weeks, setWeeks] = React.useState("6");
  const [start, setStart] = React.useState(() => addDays(ukToday(), 7));
  const depositBps = deposit.trim() === "" ? 0 : parsePercentToBps(deposit, 9_900);
  const count = Number(weeks);
  const valid = depositBps !== null && Number.isInteger(count) && count >= 1 && count <= MAX_PAYMENT_STAGES - 1 && /^\d{4}-\d{2}-\d{2}$/.test(start);
  const each = valid ? Math.round((total * (10_000 - depositBps)) / 10_000 / count) : 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary">
          <CalendarDays className="text-ink-2" />
          Weekly instalments
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Weekly instalments</DialogTitle>
        <DialogDescription>A deposit to book, then the rest split into equal weekly payments. This replaces the current plan; you can edit each payment after.</DialogDescription>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Deposit" hint="0 for none">
            <div className="relative">
              <input value={deposit} onChange={(e) => setDeposit(e.target.value)} inputMode="decimal" className={cn(control, "pr-7 tabular")} />
              <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-subtle">%</span>
            </div>
          </Field>
          <Field label="Weeks">
            <input value={weeks} onChange={(e) => setWeeks(e.target.value)} inputMode="numeric" className={cn(control, "tabular")} />
          </Field>
          <Field label="First payment">
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={control} />
          </Field>
        </div>
        <p className="mt-3 text-ink-2 tabular">
          {valid
            ? `${depositBps > 0 ? `${formatBps(depositBps)} deposit (${formatGBP(Math.round((total * depositBps) / 10_000))}), then ` : ""}${count} × about ${formatGBP(each)} weekly.`
            : "Enter a deposit under 99%, 1 to 59 weeks and a start date."}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button
            disabled={!valid}
            onClick={() => {
              if (!valid) return;
              const instalments = weeklyInstalments({ count, startDate: start, totalBps: 10_000 - depositBps, ids: Array.from({ length: count }, uuid) });
              onApply(depositBps > 0 ? [{ id: uuid(), label: "Deposit", amountKind: "percent", amountValue: depositBps, dueKind: "on_acceptance" }, ...instalments] : instalments);
              setOpen(false);
            }}
          >
            Create plan
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
