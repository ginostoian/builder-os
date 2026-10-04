/**
 * Everything on the platform team's dashboard (/app/admin), worked out from the metrics functions' counts.
 * Platform admins only: the page checks `isPlatformAdmin()` before calling this.
 */
import "server-only";
import { addDays, ukToday } from "@/core/payment-plan";
import { average, bucketOf, lastMonths, mrrByMonth, stickiness, trialConversion, type CompanyBucket, type MrrMonth } from "@/core/metrics";
import type { Session } from "@/auth/session";
import { withSession } from "@/auth/session";
import { companyStats, dailyActivity, subscriptionEventsSince, userSignups, type CompanyStats, type DailyActivity } from "@/db/platform";

export type CompanyRow = CompanyStats & { bucket: CompanyBucket };

export type PlatformDashboard = {
  today: string;
  companies: CompanyRow[];
  counts: Record<CompanyBucket, number> & { total: number; newThisMonth: number; deleted: number };
  paidByPlan: { essentials: number; pro: number };
  users: { total: number; newThisMonth: number };
  mrr: { now: number; lastMonthEnd: number; arpa: number | null; months: MrrMonth[]; cancelling: number };
  churn: { lastMonth: MrrMonth | null; avg3Logo: number | null; avg3Revenue: number | null };
  trial: { ended: number; converted: number; rate: number | null };
  activity: {
    days: DailyActivity[];
    dau: number;
    dau7: number;
    wau: number;
    mau: number;
    stickiness: number | null;
    sessionsPerUserDay: number;
    viewsPerUserDay: number;
    siteShare: number | null;
    activeCompanies30: number;
  };
  growth: { weeks: { start: string; companies: number; users: number }[] };
  payments: { online30dPence: number; all30dPence: number; companiesTakingOnline: number };
};

const monthKey = (iso: string) => iso.slice(0, 7);

export async function loadPlatformDashboard(session: Session, now = new Date()): Promise<PlatformDashboard> {
  const today = ukToday(now);
  const months = lastMonths(now, 12);
  const [stats, days, events, signups] = await withSession(session, async (tx) => [
    await companyStats(tx, today),
    await dailyActivity(tx, addDays(today, -89), today),
    await subscriptionEventsSince(tx, new Date(`${months[0]}T00:00:00Z`)),
    await userSignups(tx, addDays(today, -83)),
  ] as const);

  const companies: CompanyRow[] = stats.map((c) => ({ ...c, bucket: bucketOf(c, now) }));
  const live = companies.filter((c) => !c.deletedAt);
  const thisMonth = monthKey(today);

  const counts = { paying: 0, past_due: 0, trial: 0, comped: 0, free: 0, total: live.length, newThisMonth: 0, deleted: companies.length - live.length };
  const paidByPlan = { essentials: 0, pro: 0 };
  for (const c of live) {
    counts[c.bucket]++;
    if (ukToday(c.createdAt).startsWith(thisMonth)) counts.newThisMonth++;
    if ((c.bucket === "paying" || c.bucket === "past_due") && c.plan !== "free") paidByPlan[c.plan]++;
  }

  const mrrMonths = mrrByMonth(new Map(companies.map((c) => [c.id, c.mrrPence])), events.map((e) => ({ orgId: e.orgId, at: e.at, before: e.before, after: e.after })), months);
  const mrrNow = live.reduce((n, c) => n + c.mrrPence, 0);
  const payingCount = live.filter((c) => c.mrrPence > 0).length;
  const full = mrrMonths.slice(0, -1);
  const last3 = full.slice(-3);
  const rates = (k: "logoChurn" | "revenueChurn") => {
    const xs = last3.map((m) => m[k]).filter((v): v is number => v !== null);
    return xs.length ? average(xs) : null;
  };

  const last7 = days.slice(-7);
  const last30 = days.slice(-30);
  const todayRow = days.at(-1);
  const activeDays = last30.filter((d) => d.activeUsers > 0);
  const userDays = activeDays.reduce((n, d) => n + d.activeUsers, 0);
  const views30 = last30.reduce((n, d) => n + d.views, 0);
  const dau7 = average(last7.map((d) => d.activeUsers));

  // Twelve weeks of sign-ups, Monday to Sunday (UK dates).
  const weekday = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7;
  const thisMonday = addDays(today, -weekday);
  const weeks = Array.from({ length: 12 }, (_, i) => ({ start: addDays(thisMonday, -7 * (11 - i)), companies: 0, users: 0 }));
  const weekOf = (day: string) => weeks.findLast((w) => w.start <= day);
  for (const c of companies) {
    const w = weekOf(ukToday(c.createdAt));
    if (w && ukToday(c.createdAt) >= weeks[0].start) w.companies++;
  }
  for (const s of signups) {
    const w = weekOf(s.day);
    if (w && s.day >= weeks[0].start) w.users += s.users;
  }

  return {
    today,
    companies,
    counts,
    paidByPlan,
    users: { total: live.reduce((n, c) => n + c.users, 0), newThisMonth: signups.filter((s) => s.day.startsWith(thisMonth)).reduce((n, s) => n + s.users, 0) },
    mrr: { now: mrrNow, lastMonthEnd: full.at(-1)?.end ?? 0, arpa: payingCount ? mrrNow / payingCount : null, months: mrrMonths, cancelling: live.filter((c) => c.mrrPence > 0 && c.cancelAtPeriodEnd).length },
    churn: { lastMonth: full.at(-1) ?? null, avg3Logo: rates("logoChurn"), avg3Revenue: rates("revenueChurn") },
    trial: trialConversion(live, now),
    activity: {
      days,
      dau: todayRow?.activeUsers ?? 0,
      dau7,
      wau: todayRow?.wau ?? 0,
      mau: todayRow?.mau ?? 0,
      stickiness: stickiness(dau7, todayRow?.mau ?? 0),
      sessionsPerUserDay: userDays ? activeDays.reduce((n, d) => n + d.sessions, 0) / userDays : 0,
      viewsPerUserDay: userDays ? views30 / userDays : 0,
      siteShare: views30 ? last30.reduce((n, d) => n + d.siteViews, 0) / views30 : null,
      activeCompanies30: live.filter((c) => c.active30d > 0).length,
    },
    growth: { weeks },
    payments: {
      online30dPence: live.reduce((n, c) => n + c.paidOnline30dPence, 0),
      all30dPence: live.reduce((n, c) => n + c.paid30dPence, 0),
      companiesTakingOnline: live.filter((c) => c.onlinePayments).length,
    },
  };
}
