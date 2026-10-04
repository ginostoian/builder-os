/**
 * The platform team's numbers, worked out from plain rows so they can be tested without a database:
 * which bucket each company is in (free, trial, comped, paying), monthly recurring revenue (MRR) month by
 * month with its movements (new, expansion, contraction, churn), churn rates, and active-user stickiness.
 *
 * MRR comes from `subscription_events` (every change to what a company pays us) and each company's current
 * `mrr_pence`: walking the events back from today gives what anyone paid at any earlier moment.
 */
import { entitlement, type Plan } from "./plans";

export type CompanyBucket = "paying" | "past_due" | "trial" | "comped" | "free";

export const BUCKET_LABEL: Record<CompanyBucket, string> = {
  paying: "Paying",
  past_due: "Payment failed",
  trial: "In trial",
  comped: "Complimentary",
  free: "Free",
};

export type CompanyFacts = {
  plan: Plan;
  comped: boolean;
  trialEndsAt: Date | null;
  subscriptionStatus: string | null;
  mrrPence: number;
};

/** Where a company stands. Complimentary wins (it gets Pro whatever else is true), then a live subscription. */
export function bucketOf(c: CompanyFacts, now: Date): CompanyBucket {
  const ent = entitlement({ plan: c.plan, comped: c.comped, trialEndsAt: c.trialEndsAt, subscriptionStatus: c.subscriptionStatus, currentPeriodEnd: null, cancelAtPeriodEnd: false }, now);
  if (ent.why === "comped") return "comped";
  if (ent.why === "subscription") return ent.pastDue ? "past_due" : c.subscriptionStatus === "trialing" ? "trial" : "paying";
  return ent.why === "trial" ? "trial" : "free";
}

export type MrrEvent = { orgId: string; at: Date; before: number; after: number };

export type MrrMonth = {
  /** First day of the month, YYYY-MM-01 (UTC). */
  month: string;
  start: number;
  end: number;
  newMrr: number;
  expansion: number;
  contraction: number;
  churned: number;
  /** Companies paying at the start, and how many of them pay nothing at the end. */
  payingAtStart: number;
  churnedCompanies: number;
  /** Share of the start's paying companies lost (0–1), or null with none at the start. */
  logoChurn: number | null;
  /** MRR lost to churn and downgrades, over the start's MRR (0–1), or null with none at the start. */
  revenueChurn: number | null;
};

/** The first of this month and the `count - 1` months before it, oldest first, as YYYY-MM-01. */
export function lastMonths(now: Date, count: number): string[] {
  const out: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

const monthStart = (month: string) => new Date(`${month}T00:00:00Z`);
const nextMonth = (month: string) => {
  const d = monthStart(month);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
};

/**
 * Month-by-month MRR and its movements. `current` is each company's MRR now; `events` must include every
 * event since the first month's start (more is fine). The current month runs up to now.
 */
export function mrrByMonth(current: Map<string, number>, events: MrrEvent[], months: string[]): MrrMonth[] {
  const sorted = [...events].sort((a, b) => a.at.getTime() - b.at.getTime());
  const orgs = new Set([...current.keys(), ...sorted.map((e) => e.orgId)]);
  /** What a company paid at a moment: the `before` of its first later event, else what it pays now. */
  const at = (orgId: string, t: Date) => {
    const later = sorted.find((e) => e.orgId === orgId && e.at.getTime() >= t.getTime());
    return later ? later.before : (current.get(orgId) ?? 0);
  };
  return months.map((month) => {
    const from = monthStart(month);
    const to = nextMonth(month);
    let start = 0;
    let end = 0;
    let payingAtStart = 0;
    let churnedCompanies = 0;
    for (const org of orgs) {
      const s = at(org, from);
      const e = at(org, to);
      start += s;
      end += e;
      if (s > 0) {
        payingAtStart++;
        if (e === 0) churnedCompanies++;
      }
    }
    let newMrr = 0;
    let expansion = 0;
    let contraction = 0;
    let churned = 0;
    for (const e of sorted) {
      if (e.at < from || e.at >= to) continue;
      if (e.before === 0 && e.after > 0) newMrr += e.after;
      else if (e.before > 0 && e.after === 0) churned += e.before;
      else if (e.after > e.before) expansion += e.after - e.before;
      else contraction += e.before - e.after;
    }
    return {
      month,
      start,
      end,
      newMrr,
      expansion,
      contraction,
      churned,
      payingAtStart,
      churnedCompanies,
      logoChurn: payingAtStart > 0 ? churnedCompanies / payingAtStart : null,
      revenueChurn: start > 0 ? (churned + contraction) / start : null,
    };
  });
}

/** Of the trials that ended in the window, how many companies now pay (or have a live subscription). */
export function trialConversion(companies: (CompanyFacts & { deletedAt: Date | null })[], now: Date, days = 90): { ended: number; converted: number; rate: number | null } {
  const since = now.getTime() - days * 86_400_000;
  let ended = 0;
  let converted = 0;
  for (const c of companies) {
    if (c.comped || !c.trialEndsAt) continue;
    const t = c.trialEndsAt.getTime();
    if (t > now.getTime() || t < since) continue;
    ended++;
    const b = bucketOf(c, now);
    if (b === "paying" || b === "past_due") converted++;
  }
  return { ended, converted, rate: ended > 0 ? converted / ended : null };
}

/** Daily actives over monthly actives (0–1): how often the people who use it come back. */
export const stickiness = (dau: number, mau: number) => (mau > 0 ? dau / mau : null);

export const average = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);
