import type { Metadata } from "next";
import Link from "next/link";
import { AdminShell } from "@/components/admin/admin-shell";
import { BarChart, Kpi, ShareBar } from "@/components/admin/charts";
import { BUCKET_STYLE, date, dayMonth, gbp, monthName, monthYear, num, pct } from "@/components/admin/format";
import { Panel, ScreenTitle } from "@/components/app/app-shell";
import { BUCKET_LABEL, type CompanyBucket } from "@/core/metrics";
import { cn } from "@/lib/utils";
import { requirePlatformAdmin } from "@/auth/platform-admin";
import { loadPlatformDashboard } from "@/server/platform-dashboard";

export const metadata: Metadata = { title: "Overview" };

/** The website owner's view of Builder OS as a business: customers, revenue, churn and usage. */
export default async function AdminOverviewPage() {
  const me = await requirePlatformAdmin();
  const now = new Date();
  const d = await loadPlatformDashboard(now);
  const mrrChange = d.mrr.now - d.mrr.lastMonthEnd;
  const days30 = d.activity.days.slice(-30);

  return (
    <AdminShell active="overview" who={me.email}>
      <ScreenTitle title="Overview" subtitle={`How Builder OS is doing, as of ${date(now)}.`} />

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
            <div className="flex items-baseline justify-between">
              <h2 className="font-semibold">Companies by plan</h2>
              <Link href="/admin/companies" className="text-[12px] text-ink-2 hover:text-ink">
                All companies
              </Link>
            </div>
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
                    <td className="px-2 py-1.5">{monthYear(m.month)}</td>
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

        <p className="pb-2 text-[11.5px] text-subtle">
          Usage counts page views from the office app and the site app (in brackets), per person per UK day; usage before this page existed isn&apos;t known. MRR is what live subscriptions pay a
          month before VAT, recorded each time Stripe tells us of a change.
        </p>
    </AdminShell>
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
