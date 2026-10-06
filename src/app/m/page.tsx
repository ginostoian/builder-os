import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, HardHat, MapPin } from "lucide-react";
import { CheckIn } from "@/components/site/check-in";
import { MyTasks } from "@/components/site/my-tasks";
import { SiteFrame, SiteHeading } from "@/components/site/site-frame";
import { isForToday, toMyTask } from "@/components/site/to-my-task";
import { formatAddress } from "@/core/clients";
import { addDays, ukToday } from "@/core/payment-plan";
import { londonToUtc } from "@/core/surveys";
import { mySurveys } from "@/db/surveys";
import { MySurveys } from "@/components/site/my-surveys";
import { can } from "@/core/roles";
import { myJobs, myTasks, openVisit, workerForMember } from "@/db/site";
import { requirePermission, withSession } from "@/auth/session";
import { hasFeature } from "@/server/plan";
import { SiteLocked } from "@/components/site/site-locked";

export const metadata: Metadata = { title: "Today" };

const longToday = (iso: string) => new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));

function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: "Europe/London" }).format(new Date()));
  return h < 12 ? "Morning" : h < 18 ? "Afternoon" : "Evening";
}

/** The site app's home: check in, today's tasks across my jobs, and my jobs. */
export default async function SiteTodayPage() {
  const session = await requirePermission("site.app");
  if (!(await hasFeature("site_app"))) return <SiteLocked office={can(session.role, "app.office")} />;
  const today = ukToday();
  const office = can(session.role, "app.office");
  // Today's and tomorrow's survey visits are mine whether or not I'm on the team list (estimators often aren't).
  const surveys = await withSession(session, (tx) => mySurveys(tx, session.orgId, session.memberId, londonToUtc(today, 0), londonToUtc(addDays(today, 2), 0)));
  const surveyList = surveys.length > 0 && (
    <>
      <SiteHeading title="Surveys" aside={`${surveys.length}`} />
      <MySurveys surveys={surveys} today={today} canOpenLead={can(session.role, "leads.view")} />
    </>
  );
  const data = await withSession(session, async (tx) => {
    const worker = await workerForMember(tx, session.orgId, session.memberId);
    if (!worker) return null;
    const me = { workerId: worker.id, memberId: session.memberId };
    return { worker, jobs: await myJobs(tx, session.orgId, me), tasks: await myTasks(tx, session.orgId, worker.id), open: await openVisit(tx, session.orgId, worker.id) };
  });
  const firstName = session.memberName.split(" ")[0];

  if (!data) {
    return (
      <SiteFrame eyebrow={longToday(today)} title={`${greeting()}, ${firstName}`} office={office}>
        {surveyList}
        <div className="flex flex-col items-center gap-2 rounded-2xl bg-white px-6 py-10 text-center shadow-ring">
          <HardHat className="size-6 text-subtle" strokeWidth={1.5} />
          <p className="font-medium">You&apos;re not on the team list</p>
          <p className="text-subtle">Ask the office to add you under Team and link your login. Then your jobs and tasks show up here.</p>
        </div>
      </SiteFrame>
    );
  }

  const all = data.tasks.map((t) => ({ row: t, task: toMyTask(t, today) }));
  const todays = all.filter((t) => isForToday(t.row, today)).map((t) => t.task);
  const later = all.filter((t) => !isForToday(t.row, today)).map((t) => t.task);
  const done = todays.filter((t) => t.status === "done").length;

  return (
    <SiteFrame eyebrow={longToday(today)} title={`${greeting()}, ${firstName}`} office={office} sync={{ memberId: session.memberId, jobIds: data.jobs.map((j) => j.id) }}>
      {(data.open || data.jobs.length > 0) && (
        <CheckIn open={data.open ? { projectId: data.open.projectId, projectName: data.open.projectName, checkedInAt: data.open.checkedInAt.toISOString() } : null} jobs={data.jobs.map((j) => ({ id: j.id, name: j.name }))} />
      )}

      {surveyList}

      <SiteHeading title="Today" aside={todays.length > 0 ? `${done} of ${todays.length} done` : undefined} />
      <MyTasks tasks={todays} showJob />

      {later.length > 0 && (
        <>
          <SiteHeading title="Coming up" aside={`${later.length}`} />
          <MyTasks tasks={later} showJob />
        </>
      )}

      <SiteHeading title="My jobs" />
      {data.jobs.length === 0 ? (
        <p className="rounded-2xl bg-white px-4 py-5 text-center text-subtle shadow-ring">No current jobs. When the office gives you a task on a job, it shows up here.</p>
      ) : (
        <ul className="overflow-hidden rounded-2xl bg-white shadow-ring">
          {data.jobs.map((j) => (
            <li key={j.id} className="border-b border-line last:border-0">
              <Link href={`/m/jobs/${j.id}`} className="flex min-h-[64px] items-center gap-3 px-4 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{j.name}</span>
                  <span className="flex items-center gap-1 truncate text-xs text-subtle">
                    {j.siteAddress ? (
                      <>
                        <MapPin className="size-3 flex-none" />
                        <span className="truncate">{formatAddress(j.siteAddress)}</span>
                      </>
                    ) : (
                      j.clientName
                    )}
                  </span>
                </span>
                {j.openTasks > 0 && <span className="text-[13px] text-subtle tabular">{j.openTasks} to do</span>}
                <ChevronRight className="size-4 text-faint-2" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </SiteFrame>
  );
}
