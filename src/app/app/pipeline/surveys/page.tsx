import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LiveAppShell } from "@/components/app/live-app-shell";
import { Panel, ScreenTitle } from "@/components/app/app-shell";
import { SurveyHoursEditor, SurveySettingsForm } from "@/components/app/pipeline/survey-settings";
import { listSurveyHours, getSurveySettings, surveyors } from "@/db/surveys";
import { requirePermission, withSession } from "@/auth/session";
import { emailConfigured } from "@/server/email";

export const metadata: Metadata = { title: "Online booking" };

/**
 * How clients book survey visits online: the company's rules (length, travel time, notice, how far ahead,
 * areas) and each surveyor's weekly hours.
 */
export default async function SurveySettingsPage() {
  const session = await requirePermission("automations.manage");
  const data = await withSession(session, async (tx) => ({ settings: await getSurveySettings(tx, session.orgId), hours: await listSurveyHours(tx, session.orgId), people: await surveyors(tx, session.orgId) }));
  return (
    <LiveAppShell active="pipeline" crumbs={["Pipeline", "Online booking"]}>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto bg-surface-2 px-6 py-[18px]">
        <Link href="/app/pipeline" className="flex items-center gap-1.5 self-start text-[12.5px] text-ink-2 hover:text-ink">
          <ArrowLeft className="size-3.5" />
          Pipeline
        </Link>
        <ScreenTitle title="Online survey booking" subtitle="Let enquiries book a survey visit themselves, straight into your diary. You can still move or cancel any visit." />
        <div className="grid max-w-[1100px] grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] items-start gap-4">
          <div className="flex flex-col gap-4">
            <Panel className="p-5">
              <SurveySettingsForm settings={data.settings} />
            </Panel>
            <Panel className="p-5">
              <SurveyHoursEditor people={data.people} hours={data.hours.map(({ memberId, weekday, startMinute, endMinute }) => ({ memberId, weekday, startMinute, endMinute }))} />
            </Panel>
          </div>
          <Panel className="p-5 text-[12.5px] text-ink-2">
            <h2 className="mb-2 text-[13px] font-semibold text-ink">How it works</h2>
            <ol className="flex list-decimal flex-col gap-1.5 pl-4">
              <li>After sending your web enquiry form, people can pick a time straight away.</li>
              <li>
                Add <code className="rounded bg-surface px-1">{"{{booking_link}}"}</code> to an <Link href="/app/pipeline/automations" className="text-ink underline underline-offset-2">automation email</Link>, or copy a lead&apos;s booking link from their page, to invite anyone else.
              </li>
              <li>We only offer times when one of your surveyors is free, with travel time either side. Two people can never book the same slot.</li>
              <li>The lead moves to Site visit, the surveyor gets a notification, and the visit shows in the calendar and their site app.</li>
              <li>{emailConfigured() ? "The client gets a confirmation with a calendar invite, and a reminder the day before." : "Once email is set up, the client gets a confirmation with a calendar invite, and a reminder the day before."}</li>
              <li>They can move or cancel it from the same link. If they cancel, the lead gets a follow-up for today.</li>
            </ol>
          </Panel>
        </div>
      </div>
    </LiveAppShell>
  );
}
