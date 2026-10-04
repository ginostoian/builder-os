/**
 * Platform metrics: recording how much people use the app (in their own tenant), and reading the totals
 * across every company for the platform team's dashboard. The reads go through SECURITY DEFINER functions
 * owned by the read-only `builderos_metrics` role (migration 0019), which return counts, never content.
 */
import "server-only";
import { sql } from "drizzle-orm";
import type { Plan } from "@/core/plans";
import type { Tx } from "./index";

/**
 * One page view by a member, today (UK date). A view after 30 minutes away starts a new session.
 * `site` marks views in the site app (/m).
 */
export async function recordActivity(tx: Tx, orgId: string, memberId: string, day: string, site: boolean, now = new Date()): Promise<void> {
  await tx.execute(sql`
    insert into member_activity (org_id, member_id, day, views, sessions, site_views, first_at, last_at)
    values (${orgId}::uuid, ${memberId}::uuid, ${day}::date, 1, 1, ${site ? 1 : 0}, ${now.toISOString()}::timestamptz, ${now.toISOString()}::timestamptz)
    on conflict (org_id, member_id, day) do update set
      views = least(member_activity.views + 1, 1000000),
      site_views = least(member_activity.site_views + excluded.site_views, least(member_activity.views + 1, 1000000)),
      sessions = least(member_activity.sessions + case when member_activity.last_at < excluded.last_at - interval '30 minutes' then 1 else 0 end, 100000),
      last_at = greatest(member_activity.last_at, excluded.last_at)`);
}

export type CompanyStats = {
  id: string;
  name: string;
  createdAt: Date;
  plan: Plan;
  comped: boolean;
  trialEndsAt: Date | null;
  subscriptionStatus: string | null;
  cancelAtPeriodEnd: boolean;
  mrrPence: number;
  onlinePayments: boolean;
  deletedAt: Date | null;
  users: number;
  active7d: number;
  active30d: number;
  lastActiveAt: Date | null;
  views30d: number;
  siteViews30d: number;
  quotesSent30d: number;
  quotesSentTotal: number;
  projects: number;
  leads30d: number;
  paidOnline30dPence: number;
  paid30dPence: number;
};

const date = (v: string | Date | null) => (v ? new Date(v) : null);

/** Every company: plan, what it pays, and how much it's used. `today` is the UK date. */
export async function companyStats(tx: Tx, today: string): Promise<CompanyStats[]> {
  const rows = await tx.execute<Record<string, string | number | boolean | null>>(sql`select * from app_platform_company_stats(${today}::date)`);
  return rows.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    createdAt: new Date(String(r.created_at)),
    plan: r.plan as Plan,
    comped: r.comped === true,
    trialEndsAt: date(r.trial_ends_at as string | null),
    subscriptionStatus: (r.subscription_status as string | null) ?? null,
    cancelAtPeriodEnd: r.cancel_at_period_end === true,
    mrrPence: Number(r.mrr_pence),
    onlinePayments: r.online_payments === true,
    deletedAt: date(r.deleted_at as string | null),
    users: Number(r.users),
    active7d: Number(r.active_7d),
    active30d: Number(r.active_30d),
    lastActiveAt: date(r.last_active_at as string | null),
    views30d: Number(r.views_30d),
    siteViews30d: Number(r.site_views_30d),
    quotesSent30d: Number(r.quotes_sent_30d),
    quotesSentTotal: Number(r.quotes_sent_total),
    projects: Number(r.projects),
    leads30d: Number(r.leads_30d),
    paidOnline30dPence: Number(r.paid_online_30d_pence),
    paid30dPence: Number(r.paid_30d_pence),
  }));
}

export type DailyActivity = { day: string; activeUsers: number; activeCompanies: number; views: number; sessions: number; siteViews: number; wau: number; mau: number };

/** Per UK day from `from` to `to` (inclusive, at most 400 days). */
export async function dailyActivity(tx: Tx, from: string, to: string): Promise<DailyActivity[]> {
  const rows = await tx.execute<{ day: string; active_users: number; active_companies: number; views: number; sessions: number; site_views: number; wau: number; mau: number }>(
    sql`select day::text as day, active_users, active_companies, views, sessions, site_views, wau, mau from app_platform_daily_activity(${from}::date, ${to}::date)`,
  );
  return rows.map((r) => ({ day: r.day, activeUsers: r.active_users, activeCompanies: r.active_companies, views: r.views, sessions: r.sessions, siteViews: r.site_views, wau: r.wau, mau: r.mau }));
}

export type SubscriptionEvent = { orgId: string; at: Date; plan: Plan; status: string; before: number; after: number };

/** Changes to what companies pay us, since a moment, oldest first. */
export async function subscriptionEventsSince(tx: Tx, since: Date): Promise<SubscriptionEvent[]> {
  const rows = await tx.execute<{ org_id: string; at: string; plan: Plan; status: string; mrr_before_pence: number; mrr_after_pence: number }>(
    sql`select * from app_platform_subscription_events(${since.toISOString()}::timestamptz)`,
  );
  return rows.map((r) => ({ orgId: r.org_id, at: new Date(r.at), plan: r.plan, status: r.status, before: r.mrr_before_pence, after: r.mrr_after_pence }));
}

/** New logins (team members) per UK day since a date. */
export async function userSignups(tx: Tx, from: string): Promise<{ day: string; users: number }[]> {
  const rows = await tx.execute<{ day: string; users: number }>(sql`select day::text as day, users from app_platform_user_signups(${from}::date)`);
  return rows.map((r) => ({ day: r.day, users: r.users }));
}
