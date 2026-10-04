import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LiveAppShell } from "@/components/app/live-app-shell";
import { Panel, ScreenTitle } from "@/components/app/app-shell";
import { CompToggle } from "@/components/app/admin/comp-toggle";
import { BarChart, Kpi, ShareBar } from "@/components/app/admin/charts";
import { BUCKET_LABEL, type CompanyBucket } from "@/core/metrics";
import { formatGBP } from "@/core/money";
import { PLAN_LABEL } from "@/core/plans";
import { requirePermission } from "@/auth/session";
import { isPlatformAdmin } from "@/server/platform-admin";
import { loadPlatformDashboard, type CompanyRow } from "@/server/platform-dashboard";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Platform", robots: { index: false } };

const tz = { timeZone: "Europe/London" } as const;
const dayMonth = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
const monthName = (iso: string) => new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
const date = (d: Date) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", ...tz }).format(d);
const pct = (v: number | null, digits = 1) => (v === null ? "–" : `${(v * 100).toFixed(digits)}%`);
const num = (v: number, digits = 0) => v.toLocaleString("en-GB", { maximumFractionDigits: digits, minimumFractionDigits: digits });
const gbp = (pence: number) => formatGBP(Math.round(pence), 0);

function ago(d: Date | null, now: Date) {
  if (!d) return "Never";
  const mins = Math.round((now.getTime() - d.getTime()) / 60_000);
  if (mins < 60) return mins <= 1 ? "Just now" : `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days < 60 ? `${days}d ago` : date(d);
}

const BUCKET_STYLE: Record<CompanyBucket, string> = {
  paying: "bg-success",
  past_due: "bg-danger",
  trial: "bg-brand",
  comped: "bg-info",
  free: "bg-faint",
};

const SORTS = {
  mrr: { label: "MRR", by: (a: CompanyRow, b: CompanyRow) => b.mrrPence - a.mrrPence || b.active30d - a.active30d },
  active: { label: "Most active", by: (a: CompanyRow, b: CompanyRow) => b.views30d - a.views30d },
  recent: { label: "Last active", by: (a: CompanyRow, b: CompanyRow) => (b.lastActiveAt?.getTime() ?? 0) - (a.lastActiveAt?.getTime() ?? 0) },
  joined: { label: "Newest", by: (a: CompanyRow, b: CompanyRow) => b.createdAt.getTime() - a.createdAt.getTime() },
} as const;
type Sort = keyof typeof SORTS;

/** Platform team only: how Builder OS is doing. Companies, plans, revenue, churn and usage. */
export default async function PlatformPage({ searchParams }: { searchParams: Promise<{ sort?: string; show?: string }> }) {
  const session = await requirePermission("app.office");
  if (!(await isPlatformAdmin())) notFound();
  const params = await searchParams;
  const sort: Sort = params.sort && params.sort in SORTS ? (params.sort as Sort) : "mrr";
  const show = params.show && params.show in BUCKET_LABEL ? (params.show as CompanyBucket) : params.show === "deleted" ? "deleted" : null;
  const now = new Date();
  const d = await loadPlatformDashboard(session, now);

  const mrrChange = d.mrr.now - d.mrr.lastMonthEnd;
  const rows = d.companies
    .filter((c) => (show === "deleted" ? c.deletedAt : !c.deletedAt && (!show || c.bucket === show)))
    .sort(SORTS[sort].by);
  const href = (next: { sort?: Sort; show?: string | null }) => {
    const q = new URLSearchParams();
    const s = next.sort ?? sort;
    const f = next.show === undefined ? show : next.show;
    if (s !== "mrr") q.set("sort", s);
    if (f) q.set("show", f);
    const str = q.toString();
    return `/app/admin${str ? `?${str}` : ""}#companies`;
  };
  const days30 = d.activity.days.slice(-30);

  return (
    <LiveAppShell active="settings" crumbs={["Builder OS", "Platform"]}>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto bg-surface-2 px-6 py-[18px]">
        <ScreenTitle title="Platform" subtitle={`How Builder OS is doing, as of ${date(now)}. Only the platform team can see this page.`} />

        <section aria-label="Headline numbers" className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-6">
          <Kpi
            label="MRR"
            value={gbp(d.mrr.now)}
            note={d.mrr.lastMonthEnd || mrrChange ? `${mrrChange >= 0 ? "+" : "−"}${gbp(Math.abs(mrrChange))} this month · ARR ${gbp(d.mrr.now * 12)}` : `ARR ${gbp(d.mrr.now * 12)}`}
            tone={mrrChange > 0 ? "good" : mrrChange < 0 ? "bad" : undefined}
          />
          <Kpi label="Paying companies" value={num(d.counts.paying + d.counts.past_due)} note={d.mrr.arpa === null ? "No one pays yet" : `${gbp(d.mrr.arpa)} average a month`} />
          <Kpi label="Companies" value={num(d.counts.total)} note={`${d.counts.newThisMonth} new this month`} />
          <Kpi label="Users" value={num(d.users.total)} note={`${d.users.newThisMonth} new this month`} />
          <Kpi label="Daily active users" value={num(d.activity.dau)} note={`${num(d.activity.dau7, 1)} a day, last 7 days`} />
          <Kpi label="Monthly active users" value={num(d.activity.mau)} note={`DAU/MAU ${pct(d.activity.stickiness, 0)} · WAU ${num(d.activity.wau)}`} />
        </section>

        <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <Panel className="p-4">
            <h2 className="font-semibold">Companies by plan</h2>
            <p className="mt-0.5 text-[12.5px] text-subtle">Each company once. Complimentary companies get Pro free; trials are 14 days of Pro.</p>
            <div className="mt-3.5">
              <ShareBar parts={(Object.keys(BUCKET_LABEL) as CompanyBucket[]).map((b) => ({ label: BUCKET_LABEL[b], value: d.counts[b], className: BUCKET_STYLE[b] }))} />
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-3.5 text-[12.5px] sm:grid-cols-4">
              <Stat label="On Essentials" value={num(d.paidByPlan.essentials)} />
              <Stat label="On Pro" value={num(d.paidByPlan.pro)} />
              <Stat label="Trial → paid (90 days)" value={pct(d.trial.rate, 0)} note={`${d.trial.converted} of ${d.trial.ended} trials`} />
              <Stat label="Cancelling at period end" value={num(d.mrr.cancelling)} />
            </dl>
          </Panel>

          <Panel className="p-4">
            <h2 className="font-semibold">Churn</h2>
            <p className="mt-0.5 text-[12.5px] text-subtle">Last full month ({d.churn.lastMonth ? monthName(d.churn.lastMonth.month) : "–"}), and the average of the last three.</p>
            <dl className="mt-3.5 grid grid-cols-2 gap-3 text-[12.5px]">
              <Stat big label="Company churn" value={pct(d.churn.lastMonth?.logoChurn ?? null)} note={`3-month average ${pct(d.churn.avg3Logo)} · ${d.churn.lastMonth?.churnedCompanies ?? 0} of ${d.churn.lastMonth?.payingAtStart ?? 0} stopped paying`} />
              <Stat big label="Revenue churn" value={pct(d.churn.lastMonth?.revenueChurn ?? null)} note={`3-month average ${pct(d.churn.avg3Revenue)} · cancellations and downgrades over starting MRR`} />
              <Stat label="Client payments online, 30 days" value={gbp(d.payments.online30dPence)} note={`${d.payments.companiesTakingOnline} companies take them · ${gbp(d.payments.all30dPence)} paid in total`} />
              <Stat label="Companies active, 30 days" value={`${num(d.activity.activeCompanies30)} of ${num(d.counts.total)}`} note={pct(d.counts.total ? d.activity.activeCompanies30 / d.counts.total : null, 0)} />
            </dl>
          </Panel>
        </div>

        <Panel className="p-4">
          <div className="flex items-baseline justify-between">
            <h2 className="font-semibold">Monthly recurring revenue</h2>
            <span className="text-[12px] text-subtle">Last 12 months, before VAT</span>
          </div>
          <div className="mt-3">
            <BarChart points={d.mrr.months.map((m) => ({ label: monthName(m.month), value: m.end / 100 }))} format={(v) => `£${num(v)}`} barLabel="MRR at month end (this month: now)" />
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-[12.5px] tabular">
              <thead className="text-left text-[11.5px] text-subtle">
                <tr>
                  {["Month", "Start", "New", "Upgrades", "Downgrades", "Churned", "End", "Company churn", "Revenue churn"].map((h) => (
                    <th key={h} className={cn("px-2 py-1.5 font-medium", h !== "Month" && "text-right")}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...d.mrr.months].reverse().map((m) => (
                  <tr key={m.month} className="border-t border-line">
                    <td className="px-2 py-1.5">{new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${m.month}T00:00:00Z`))}</td>
                    <td className="px-2 py-1.5 text-right">{gbp(m.start)}</td>
                    <td className="px-2 py-1.5 text-right text-success">{m.newMrr ? `+${gbp(m.newMrr)}` : "–"}</td>
                    <td className="px-2 py-1.5 text-right text-success">{m.expansion ? `+${gbp(m.expansion)}` : "–"}</td>
                    <td className="px-2 py-1.5 text-right text-danger">{m.contraction ? `−${gbp(m.contraction)}` : "–"}</td>
                    <td className="px-2 py-1.5 text-right text-danger">{m.churned ? `−${gbp(m.churned)}` : "–"}</td>
                    <td className="px-2 py-1.5 text-right font-medium">{gbp(m.end)}</td>
                    <td className="px-2 py-1.5 text-right">{pct(m.logoChurn)}</td>
                    <td className="px-2 py-1.5 text-right">{pct(m.revenueChurn)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="grid gap-4 xl:grid-cols-[3fr_2fr]">
          <Panel className="p-4">
            <div className="flex items-baseline justify-between">
              <h2 className="font-semibold">Daily active users</h2>
              <span className="text-[12px] text-subtle">Last 30 days</span>
            </div>
            <div className="mt-3">
              <BarChart
                points={days30.map((x) => ({ label: dayMonth(x.day), value: x.activeUsers, line: x.mau, title: `${dayMonth(x.day)}: ${x.activeUsers} active, ${x.activeCompanies} companies, ${x.sessions} sessions, ${x.views} views · ${x.mau} monthly active` }))}
                tickEvery={5}
                width={640}
                height={190}
                barLabel="People active that day"
                lineLabel="Monthly active (30 days to that day)"
              />
            </div>
          </Panel>
          <Panel className="p-4">
            <h2 className="font-semibold">How much they use it</h2>
            <p className="mt-0.5 text-[12.5px] text-subtle">Last 30 days, per person on the days they used it. A session starts after 30 minutes away.</p>
            <dl className="mt-3.5 grid grid-cols-2 gap-3 text-[12.5px]">
              <Stat big label="Sessions a day" value={num(d.activity.sessionsPerUserDay, 1)} />
              <Stat big label="Pages a day" value={num(d.activity.viewsPerUserDay, 1)} />
              <Stat label="Weekly active users" value={num(d.activity.wau)} />
              <Stat label="Site app share of use" value={pct(d.activity.siteShare, 0)} />
            </dl>
          </Panel>
        </div>

        <Panel className="p-4">
          <div className="flex items-baseline justify-between">
            <h2 className="font-semibold">Sign-ups</h2>
            <span className="text-[12px] text-subtle">New companies (bars) and new users (line), week by week</span>
          </div>
          <div className="mt-3">
            <BarChart
              points={d.growth.weeks.map((w) => ({ label: dayMonth(w.start), value: w.companies, line: w.users, title: `Week of ${dayMonth(w.start)}: ${w.companies} companies, ${w.users} users` }))}
              barLabel="New companies"
              lineLabel="New users"
              height={170}
            />
          </div>
        </Panel>

        <Panel id="companies" className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-4 py-3">
            <h2 className="font-semibold">Companies</h2>
            <nav aria-label="Show" className="flex flex-wrap gap-1 text-[12px]">
              {([null, ...(Object.keys(BUCKET_LABEL) as CompanyBucket[]), ...(d.counts.deleted ? ["deleted" as const] : [])] as (CompanyBucket | "deleted" | null)[]).map((b) => (
                <Link
                  key={b ?? "all"}
                  href={href({ show: b })}
                  aria-current={show === b ? "true" : undefined}
                  className={cn("rounded-full px-2.5 py-1", show === b ? "bg-ink text-white" : "bg-surface text-ink-2 hover:text-ink")}
                >
                  {b === null ? `All ${d.counts.total}` : b === "deleted" ? `Deleted ${d.counts.deleted}` : `${BUCKET_LABEL[b]} ${d.counts[b]}`}
                </Link>
              ))}
            </nav>
            <div className="flex-1" />
            <nav aria-label="Sort" className="flex items-center gap-1 text-[12px] text-subtle">
              Sort:
              {(Object.keys(SORTS) as Sort[]).map((s) => (
                <Link key={s} href={href({ sort: s })} aria-current={sort === s ? "true" : undefined} className={cn("rounded px-1.5 py-0.5", sort === s ? "font-medium text-ink" : "hover:text-ink")}>
                  {SORTS[s].label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead className="bg-surface text-left text-[11.5px] text-subtle">
                <tr>
                  <th className="px-4 py-2 font-medium">Company</th>
                  <th className="px-3 py-2 font-medium">Plan</th>
                  <th className="px-3 py-2 text-right font-medium">MRR</th>
                  <th className="px-3 py-2 text-right font-medium" title="Active logins">Users</th>
                  <th className="px-3 py-2 text-right font-medium" title="People active in the last 7 / 30 days">Active 7d / 30d</th>
                  <th className="px-3 py-2 text-right font-medium" title="Page views in the last 30 days (site app in brackets)">Views 30d</th>
                  <th className="px-3 py-2 font-medium">Last active</th>
                  <th className="px-3 py-2 text-right font-medium" title="Quotes sent for the first time: last 30 days / ever">Quotes 30d / all</th>
                  <th className="px-3 py-2 text-right font-medium">Projects</th>
                  <th className="px-3 py-2 text-right font-medium" title="New leads in the last 30 days">Leads 30d</th>
                  <th className="px-3 py-2 font-medium">Complimentary</th>
                </tr>
              </thead>
              <tbody className="tabular">
                {rows.map((c) => (
                  <tr key={c.id} className="border-t border-line">
                    <td className="px-4 py-2.5">
                      <div className="font-medium">{c.name}</div>
                      <div className="text-[11.5px] text-subtle">Joined {date(c.createdAt)}{c.deletedAt ? ` · deleted ${date(c.deletedAt)}` : ""}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="flex items-center gap-1.5">
                        <span className={cn("size-2 rounded-full", BUCKET_STYLE[c.bucket])} />
                        {c.bucket === "paying" || c.bucket === "past_due" ? PLAN_LABEL[c.plan] : BUCKET_LABEL[c.bucket]}
                      </span>
                      <span className="text-[11.5px] text-subtle">
                        {c.bucket === "past_due" ? "Payment failed" : c.bucket === "trial" && c.trialEndsAt ? `Ends ${date(c.trialEndsAt)}` : c.cancelAtPeriodEnd && c.mrrPence > 0 ? "Cancelling" : ""}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right">{c.mrrPence ? gbp(c.mrrPence) : "–"}</td>
                    <td className="px-3 py-2.5 text-right">{c.users}</td>
                    <td className="px-3 py-2.5 text-right">
                      {c.active7d} / {c.active30d}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {num(c.views30d)}
                      {c.siteViews30d > 0 && <span className="text-subtle"> ({num(c.siteViews30d)})</span>}
                    </td>
                    <td className={cn("px-3 py-2.5", !c.lastActiveAt || now.getTime() - c.lastActiveAt.getTime() > 14 * 86_400_000 ? "text-danger" : "text-ink-2")}>{ago(c.lastActiveAt, now)}</td>
                    <td className="px-3 py-2.5 text-right">
                      {c.quotesSent30d} / {c.quotesSentTotal}
                    </td>
                    <td className="px-3 py-2.5 text-right">{c.projects}</td>
                    <td className="px-3 py-2.5 text-right">{c.leads30d}</td>
                    <td className="px-3 py-2.5">{!c.deletedAt && <CompToggle orgId={c.id} comped={c.comped} />}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={11} className="px-4 py-8 text-center text-subtle">
                      No companies here.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
        <p className="pb-2 text-[11.5px] text-subtle">
          Usage counts page views from the office app and the site app (in brackets), per person per UK day; usage before this page existed isn&apos;t known. MRR is what live subscriptions pay a
          month before VAT, recorded each time Stripe tells us of a change.
        </p>
      </div>
    </LiveAppShell>
  );
}

function Stat({ label, value, note, big }: { label: string; value: string; note?: string; big?: boolean }) {
  return (
    <div>
      <dt className="text-subtle">{label}</dt>
      <dd className={cn("mt-0.5 font-semibold tabular", big ? "text-[20px] tracking-[-0.02em]" : "text-[15px]")}>{value}</dd>
      {note && <dd className="mt-0.5 text-[11.5px] text-subtle">{note}</dd>}
    </div>
  );
}
