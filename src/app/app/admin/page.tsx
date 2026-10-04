import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LiveAppShell } from "@/components/app/live-app-shell";
import { Panel, ScreenTitle } from "@/components/app/app-shell";
import { CompToggle } from "@/components/app/admin/comp-toggle";
import { PLAN_LABEL, entitlement } from "@/core/plans";
import { platformCompanies } from "@/db/billing";
import { requirePermission, withSession } from "@/auth/session";
import { isPlatformAdmin } from "@/server/platform-admin";

export const metadata: Metadata = { title: "Companies", robots: { index: false } };

const day = (d: Date) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" }).format(d);

/** Platform team only: every company, its plan, and complimentary Pro. */
export default async function AdminCompaniesPage() {
  const session = await requirePermission("app.office");
  if (!(await isPlatformAdmin())) notFound();
  const companies = await withSession(session, (tx) => platformCompanies(tx));
  const now = new Date();
  return (
    <LiveAppShell active="settings" crumbs={["Builder OS", "Companies"]}>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto bg-surface-2 px-6 py-[18px]">
        <ScreenTitle title="Companies" subtitle={`${companies.length} on Builder OS. Complimentary Pro is free, forever, until you turn it off.`} />
        <Panel className="overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="bg-surface text-left text-[12px] text-subtle">
              <tr>
                <th className="px-4 py-2 font-medium">Company</th>
                <th className="px-4 py-2 font-medium">Joined</th>
                <th className="px-4 py-2 font-medium">Has</th>
                <th className="px-4 py-2 font-medium">Billing</th>
                <th className="px-4 py-2 font-medium">Complimentary</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => {
                const ent = entitlement({ plan: c.plan, comped: c.comped, trialEndsAt: c.trialEndsAt, subscriptionStatus: c.subscriptionStatus, currentPeriodEnd: null, cancelAtPeriodEnd: false }, now);
                return (
                  <tr key={c.id} className="border-t border-line">
                    <td className="px-4 py-2.5 font-medium">
                      {c.name}
                      {c.deletedAt && <span className="ml-1.5 text-[12px] text-subtle">(deleted)</span>}
                    </td>
                    <td className="px-4 py-2.5 text-ink-2">{day(c.createdAt)}</td>
                    <td className="px-4 py-2.5">
                      {PLAN_LABEL[ent.plan]}
                      <span className="text-subtle">{ent.why === "trial" ? ` · trial, ${ent.trialDaysLeft}d left` : ent.why === "comped" ? " · comped" : ""}</span>
                    </td>
                    <td className="px-4 py-2.5 text-ink-2">{c.subscriptionStatus ? `${PLAN_LABEL[c.plan]}, ${c.subscriptionStatus.replace("_", " ")}` : "None"}</td>
                    <td className="px-4 py-2.5">
                      <CompToggle orgId={c.id} comped={c.comped} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>
      </div>
    </LiveAppShell>
  );
}
