import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Mail, Plus } from "lucide-react";
import { LiveAppShell } from "@/components/app/live-app-shell";
import { Panel, ScreenTitle } from "@/components/app/app-shell";
import { AddTemplateButton, AutomationSwitch } from "@/components/app/pipeline/automation-toggles";
import { Button } from "@/components/ui/button";
import { AUTOMATION_TEMPLATES, triggerLabel } from "@/core/pipeline";
import { listAutomations } from "@/db/pipeline";
import { requirePermission, withSession } from "@/auth/session";
import { emailConfigured } from "@/server/email";

export const metadata: Metadata = { title: "Automations" };

const days = (steps: { delayDays: number }[]) => {
  let total = 0;
  return steps.map((s) => (total += s.delayDays));
};

/** The company's follow-up emails: what starts each one, its emails, and whether it's on. */
export default async function AutomationsPage() {
  const session = await requirePermission("automations.manage");
  const list = await withSession(session, (tx) => listAutomations(tx, session.orgId));
  const used = new Set(list.map((a) => a.templateKey).filter(Boolean));
  return (
    <LiveAppShell active="pipeline" crumbs={["Pipeline", "Automations"]}>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto bg-surface-2 px-6 py-[18px]">
        <Link href="/app/pipeline" className="flex items-center gap-1.5 self-start text-[12.5px] text-ink-2 hover:text-ink">
          <ArrowLeft className="size-3.5" />
          Pipeline
        </Link>
        <ScreenTitle title="Automations" subtitle="Emails that go out on their own, in your words, so no enquiry goes cold. They stop as soon as a lead moves on.">
          <Button asChild>
            <Link href="/app/pipeline/automations/new">
              <Plus />
              New automation
            </Link>
          </Button>
        </ScreenTitle>
        {!emailConfigured() && <Panel className="bg-warning-soft/40 px-4 py-3 text-[12.5px]">Email isn&apos;t set up yet, so automations won&apos;t send until it is (see the Resend steps in the setup guide).</Panel>}

        <Panel className="overflow-hidden">
          {list.length === 0 ? (
            <p className="px-6 py-8 text-center text-subtle">No automations yet. Start from one of the ready-made ones below, then make it sound like you.</p>
          ) : (
            <ul>
              {list.map((a) => {
                const at = days(a.steps);
                return (
                  <li key={a.id} className="flex items-center gap-4 border-b border-muted px-4 py-3 last:border-0">
                    <Link href={`/app/pipeline/automations/${a.id}`} className="min-w-0 flex-1 hover:underline-offset-2">
                      <span className="block font-medium hover:underline">{a.name}</span>
                      <span className="block text-[12.5px] text-subtle">
                        {triggerLabel(a.trigger, a.stage)} · {a.steps.length} email{a.steps.length === 1 ? "" : "s"} ({at.map((d) => (d === 0 ? "straight away" : `day ${d}`)).join(", ")})
                      </span>
                    </Link>
                    <span className="text-right text-[12px] text-subtle tabular">
                      {a.active > 0 && <span className="block text-ink-2">{a.active} lead{a.active === 1 ? "" : "s"} in it</span>}
                      {a.sent} sent
                    </span>
                    <AutomationSwitch id={a.id} enabled={a.enabled} />
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <div>
          <h2 className="mb-2 font-semibold">Ready-made automations</h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-3">
            {AUTOMATION_TEMPLATES.map((t) => (
              <Panel key={t.key} className="flex flex-col gap-2 p-4">
                <div className="flex items-start gap-2">
                  <Mail className="mt-0.5 size-4 flex-none text-ink-2" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{t.name}</div>
                    <div className="text-[12.5px] text-ink-2">{t.description}</div>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] text-subtle">
                    {t.steps.length} email{t.steps.length === 1 ? "" : "s"} · {triggerLabel(t.trigger, t.stage).replace(/^When /, "when ")}
                  </span>
                  <AddTemplateButton templateKey={t.key} added={used.has(t.key)} />
                </div>
              </Panel>
            ))}
          </div>
          <p className="mt-2 text-[12px] text-subtle">They&apos;re added switched off, so you can read them through and change the wording first. Every automatic email has an unsubscribe link.</p>
        </div>
      </div>
    </LiveAppShell>
  );
}
