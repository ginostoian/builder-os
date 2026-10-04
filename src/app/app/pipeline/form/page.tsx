import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LiveAppShell } from "@/components/app/live-app-shell";
import { Panel, ScreenTitle } from "@/components/app/app-shell";
import { FormSettings } from "@/components/app/pipeline/form-settings";
import { enquiryToken } from "@/db/pipeline";
import { requirePermission, withSession } from "@/auth/session";
import { emailConfigured } from "@/server/email";
import { appOrigin } from "@/server/origin";

export const metadata: Metadata = { title: "Web enquiry form" };

/** The company's public enquiry form: enquiries go straight into the pipeline, with alerts and replies. */
export default async function FormPage() {
  const session = await requirePermission("automations.manage");
  const token = await withSession(session, (tx) => enquiryToken(tx, session.orgId));
  const url = token ? `${await appOrigin()}/enquire/${token}` : null;
  return (
    <LiveAppShell active="pipeline" crumbs={["Pipeline", "Web enquiry form"]}>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto bg-surface-2 px-4 py-[18px] lg:px-6">
        <Link href="/app/pipeline" className="flex items-center gap-1.5 self-start text-[12.5px] text-ink-2 hover:text-ink">
          <ArrowLeft className="size-3.5" />
          Pipeline
        </Link>
        <ScreenTitle title="Web enquiry form" subtitle="A form for your website. Every enquiry lands in your pipeline as a new lead, with its details." />
        <div className="grid max-w-[1000px] grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] items-start gap-4">
          <Panel className="p-5">
            <FormSettings url={url} />
          </Panel>
          <Panel className="p-5 text-[12.5px] text-ink-2">
            <h2 className="mb-2 text-[13px] font-semibold text-ink">What happens with an enquiry</h2>
            <ol className="flex list-decimal flex-col gap-1.5 pl-4">
              <li>It appears in your pipeline as a new lead, with a follow-up for today.</li>
              <li>{emailConfigured() ? "Admins and the office get an email straight away (reply to it to answer them)." : "Admins and the office get an email straight away, once email is set up."}</li>
              <li>
                If you&apos;ve switched on <Link href="/app/pipeline/automations" className="text-ink underline underline-offset-2">Reply to new enquiries</Link>, they get a thank-you at once.
              </li>
            </ol>
            <p className="mt-3">The form asks for their name, email, phone, postcode, the work, a rough budget and how they heard about you. Bots are turned away quietly.</p>
          </Panel>
        </div>
      </div>
    </LiveAppShell>
  );
}
