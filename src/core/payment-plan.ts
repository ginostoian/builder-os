/**
 * Payment plans and invoice money: pure rules shared by the quote builder (live preview), sending (frozen
 * into the snapshot), invoices and reminders. Amounts are what the client pays, VAT included.
 */
import { applyBps, type Pence } from "./money";

export const PAYMENT_AMOUNT_KINDS = ["percent", "fixed", "balance"] as const;
export const PAYMENT_DUE_KINDS = ["on_acceptance", "date", "milestone"] as const;
export type AmountKind = (typeof PAYMENT_AMOUNT_KINDS)[number];
export type DueKind = (typeof PAYMENT_DUE_KINDS)[number];

export const MAX_PAYMENT_STAGES = 60;

/** One stage of a plan as stored on the quote. `amountValue` is basis points (percent) or pence (fixed). */
export type PlanStage = {
  id: string;
  label: string;
  amountKind: AmountKind;
  amountValue?: number;
  dueKind: DueKind;
  dueDate?: string;
};

export type PlannedStage = PlanStage & { amount: Pence };
export type PlanResult = { ok: true; stages: PlannedStage[] } | { ok: false; error: string; stages: PlannedStage[] };

/**
 * Work out each stage's amount for a quote total. Percent stages are a share of the total (rounded to the
 * penny), fixed stages are as entered, and the one "balance" stage takes whatever is left. Without a
 * balance stage the last stage absorbs penny rounding, but the plan must otherwise add up exactly.
 */
export function computePlan(stages: PlanStage[], total: Pence): PlanResult {
  const balances = stages.filter((s) => s.amountKind === "balance").length;
  let amounts = stages.map((s) => (s.amountKind === "percent" ? applyBps(total, s.amountValue ?? 0) : s.amountKind === "fixed" ? (s.amountValue ?? 0) : 0));
  const others = amounts.reduce((a, b) => a + b, 0);
  const planned = () => stages.map((s, i) => ({ ...s, amount: amounts[i] }));

  if (stages.length === 0) return { ok: false, error: "Add at least one payment.", stages: [] };
  if (balances > 1) return { ok: false, error: "Only one payment can be the remaining balance.", stages: planned() };
  if (balances === 1) {
    const rest = total - others;
    amounts = amounts.map((a, i) => (stages[i].amountKind === "balance" ? rest : a));
    if (rest < 0) return { ok: false, error: "The payments add up to more than the quote total.", stages: planned() };
    return { ok: true, stages: planned() };
  }
  const diff = total - others;
  // Percentages of 100% can be a few pence out after rounding each one: the last payment absorbs that.
  if (diff !== 0 && Math.abs(diff) <= stages.length) {
    amounts[amounts.length - 1] += diff;
    return { ok: true, stages: planned() };
  }
  if (diff !== 0) {
    return { ok: false, error: diff > 0 ? "The payments add up to less than the quote total. Add the remaining balance as a payment." : "The payments add up to more than the quote total.", stages: planned() };
  }
  return { ok: true, stages: planned() };
}

/** A plan for quotes that don't set one: everything on completion. */
export const DEFAULT_PLAN = (id: string): PlanStage[] => [{ id, label: "Payment on completion", amountKind: "balance", dueKind: "milestone" }];

/** ISO date `days` after `date` (calendar days, no time zones involved). */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * `count` weekly instalments from `startDate`, splitting `totalBps` of the quote equally (any leftover basis
 * points go on the last one). `ids` supplies an id per instalment.
 */
export function weeklyInstalments(opts: { count: number; startDate: string; totalBps: number; ids: string[] }): PlanStage[] {
  const count = Math.max(1, Math.min(opts.count, MAX_PAYMENT_STAGES));
  const each = Math.floor(opts.totalBps / count);
  return Array.from({ length: count }, (_, i) => ({
    id: opts.ids[i],
    label: `Week ${i + 1} instalment`,
    amountKind: "percent" as const,
    amountValue: i === count - 1 ? opts.totalBps - each * (count - 1) : each,
    dueKind: "date" as const,
    dueDate: addDays(opts.startDate, i * 7),
  }));
}

/** Split a VAT-inclusive amount into net and VAT at `vatBps`, so net + VAT is exactly the amount. */
export function splitVat(gross: Pence, vatBps: number): { net: Pence; vat: Pence } {
  const net = Math.round((gross * 10_000) / (10_000 + vatBps));
  return { net, vat: gross - net };
}

export const invoiceRef = (n: number) => `INV-${String(n).padStart(4, "0")}`;

/** Today's date in UK time, as YYYY-MM-DD. */
export const ukToday = (now = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(now);

export type InvoiceState = "paid" | "void" | "overdue" | "due_today" | "due_soon" | "upcoming";

/** Where an invoice stands today. "Due soon" is within the next 7 days. */
export function invoiceState(status: string, dueDate: string, today: string): InvoiceState {
  if (status === "paid") return "paid";
  if (status === "void") return "void";
  if (dueDate < today) return "overdue";
  if (dueDate === today) return "due_today";
  return dueDate <= addDays(today, 7) ? "due_soon" : "upcoming";
}

export const REMINDER_KINDS = ["before", "due", "overdue_3", "overdue_7"] as const;
export type ReminderKind = (typeof REMINDER_KINDS)[number];

/**
 * Which reminder an unpaid invoice should get today, if any: 3 days before it's due, on the day, 3 days
 * late, 7 days late. Only the latest one reached is sent, so an invoice created on its due date gets the
 * "due today" email, not a "due in 3 days" one as well. Each kind is sent at most once.
 */
export function reminderDue(today: string, dueDate: string, sent: ReadonlySet<string>): ReminderKind | null {
  const reached: ReminderKind[] = [];
  if (today >= addDays(dueDate, -3) && today < dueDate) reached.push("before");
  if (today >= dueDate) reached.push("due");
  if (today >= addDays(dueDate, 3)) reached.push("overdue_3");
  if (today >= addDays(dueDate, 7)) reached.push("overdue_7");
  const latest = reached.at(-1);
  if (!latest || sent.has(latest)) return null;
  // Already sent a later one (e.g. due date moved): don't go backwards.
  if (REMINDER_KINDS.slice(REMINDER_KINDS.indexOf(latest) + 1).some((k) => sent.has(k))) return null;
  return latest;
}

/** "123456" → "12-34-56". */
export const formatSortCode = (digits: string) => digits.replace(/^(\d{2})(\d{2})(\d{2})$/, "$1-$2-$3");
