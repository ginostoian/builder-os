import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ChevronLeft, ChevronRight, HardHat, MapPin, Plus, Smartphone } from "lucide-react";
import { LiveAppShell } from "@/components/app/live-app-shell";
import { Panel, ScreenTitle } from "@/components/app/app-shell";
import { TASK_DOT, initials, shortDay } from "@/components/app/projects/types";
import { VisitPlaces, VisitTimes } from "@/components/app/team/visit-times";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { addDays } from "@/core/payment-plan";
import { startOfWeek } from "@/core/projects";
import { ROLE_LABELS, can } from "@/core/roles";
import { WORKER_KIND_LABEL, formatMinutes, londonDay, taskOnDay, timesheet, visitMinutes } from "@/core/team";
import { ukToday } from "@/core/payment-plan";
import { certificateAlerts, listVisits, listWorkers, teamSchedule } from "@/db/team";
import { requirePermission, withSession } from "@/auth/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Team" };

const VIEWS = [
  { key: "people", label: "People" },
  { key: "week", label: "This week" },
  { key: "hours", label: "Timesheets" },
] as const;
type View = (typeof VIEWS)[number]["key"];

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const weekday = (iso: string) => new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));

/**
 * Everyone who works for the company (employees and subcontractors, with or without a login), who's where
 * this week, and the hours they've checked in on site.
 */
export default async function TeamPage({ searchParams }: { searchParams: Promise<{ view?: string | string[]; week?: string | string[]; archived?: string | string[] }> }) {
  const session = await requirePermission("team.view");
  const params = await searchParams;
  const view: View = VIEWS.find((v) => v.key === first(params.view))?.key ?? "people";
  const today = ukToday();
  const rawWeek = first(params.week);
  const weekStart = startOfWeek(rawWeek && /^\d{4}-\d{2}-\d{2}$/.test(rawWeek) && !Number.isNaN(Date.parse(rawWeek)) ? rawWeek : today);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const archived = first(params.archived) === "1";
  const canEdit = can(session.role, "team.edit");

  const data = await withSession(session, async (tx) => ({
    alerts: await certificateAlerts(tx, session.orgId, today),
    people: view === "people" ? await listWorkers(tx, session.orgId, { archived, today }) : [],
    schedule: view === "week" ? await teamSchedule(tx, session.orgId, weekStart) : null,
    visits: view === "hours" ? await listVisits(tx, session.orgId, { from: weekStart, to: addDays(weekStart, 6) }) : [],
    team: view === "hours" ? await listWorkers(tx, session.orgId, { today }) : [],
  }));

  const href = (v: View, extra = "") => `/app/team${v === "people" ? "" : `?view=${v}`}${extra ? `${v === "people" ? "?" : "&"}${extra}` : ""}`;
  const expired = data.alerts.filter((a) => a.expiresOn! < today);

  return (
    <LiveAppShell active="people" crumbs={["Team", VIEWS.find((v) => v.key === view)!.label]}>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto bg-surface-2 px-4 py-[18px] lg:px-6">
        <ScreenTitle title="Team" subtitle="Everyone who works for you: details, certificates, who's where and hours on site.">
          {canEdit && (
            <Button asChild>
              <Link href="/app/team/new">
                <Plus />
                Add person
              </Link>
            </Button>
          )}
        </ScreenTitle>

        {data.alerts.length > 0 && (
          <Panel className={cn("flex items-start gap-3 px-4 py-3", expired.length > 0 && "bg-danger-soft/40")}>
            <AlertTriangle className={cn("mt-0.5 size-4 flex-none", expired.length > 0 ? "text-danger" : "text-warning")} />
            <div className="min-w-0 flex-1">
              <div className="font-medium">
                {expired.length > 0 ? `${expired.length} certificate${expired.length > 1 ? "s have" : " has"} expired` : "Certificates expiring in the next 30 days"}
              </div>
              <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[12.5px] text-ink-2">
                {data.alerts.slice(0, 8).map((a) => (
                  <Link key={a.id} href={`/app/team/${a.workerId}`} className="hover:text-ink hover:underline">
                    {a.workerName}: {a.name} {a.expiresOn! < today ? "expired" : "expires"} {shortDay(a.expiresOn!)}
                  </Link>
                ))}
                {data.alerts.length > 8 && <span className="text-subtle">and {data.alerts.length - 8} more</span>}
              </div>
            </div>
          </Panel>
        )}

        <nav className="flex gap-1.5" aria-label="Team views">
          {VIEWS.map((v) => (
            <Link
              key={v.key}
              href={href(v.key, v.key !== "people" && rawWeek ? `week=${weekStart}` : "")}
              aria-current={v.key === view ? "page" : undefined}
              className={cn("rounded-full px-3 py-1 text-[12.5px] font-medium", v.key === view ? "bg-ink text-white" : "bg-white text-ink-2 shadow-ring hover:text-ink")}
            >
              {v.label}
            </Link>
          ))}
        </nav>

        {view === "people" && <People rows={data.people} archived={archived} />}

        {view !== "people" && (
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="icon">
              <Link href={href(view, `week=${addDays(weekStart, -7)}`)} aria-label="Previous week">
                <ChevronLeft />
              </Link>
            </Button>
            <span className="min-w-[150px] text-center font-medium">
              {shortDay(weekStart)} – {shortDay(addDays(weekStart, 6))}
            </span>
            <Button asChild variant="outline" size="icon">
              <Link href={href(view, `week=${addDays(weekStart, 7)}`)} aria-label="Next week">
                <ChevronRight />
              </Link>
            </Button>
            {weekStart !== startOfWeek(today) && (
              <Link href={href(view)} className="text-[12.5px] text-ink-2 hover:text-ink">
                This week
              </Link>
            )}
          </div>
        )}

        {view === "week" && data.schedule && <Week schedule={data.schedule} days={days} today={today} />}
        {view === "hours" && <Hours visits={data.visits} team={data.team} days={days} today={today} canEdit={can(session.role, "team.edit")} />}
      </div>
    </LiveAppShell>
  );
}

function People({ rows, archived }: { rows: Awaited<ReturnType<typeof listWorkers>>; archived: boolean }) {
  return (
    <>
      {rows.length === 0 ? (
        <Panel className="flex flex-col items-center gap-2 px-6 py-14 text-center">
          <HardHat className="size-6 text-subtle" strokeWidth={1.5} />
          <p className="font-medium">{archived ? "Nobody archived" : "No one on the team yet"}</p>
          {!archived && <p className="max-w-[440px] text-subtle">Add the people who work for you, with or without a login: employees, labourers and subcontractors. Then give them tasks on projects.</p>}
        </Panel>
      ) : (
        <Panel className="overflow-hidden">
          <table className="w-full">
            <thead className="border-b border-hairline text-left text-[12px] text-subtle">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Trade</th>
                <th className="px-4 py-2 font-medium">Phone</th>
                <th className="px-4 py-2 font-medium">Site app</th>
                <th className="px-4 py-2 text-right font-medium">Open tasks</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-muted last:border-0 hover:bg-surface-2">
                  <td className="px-4 py-2">
                    <Link href={`/app/team/${r.id}`} className="flex items-center gap-2.5">
                      <span className="flex size-7 flex-none items-center justify-center rounded-full bg-av-sage text-[11px] font-semibold text-ink-3">{initials(r.name)}</span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{r.name}</span>
                        <span className="block text-[11.5px] text-subtle">{WORKER_KIND_LABEL[r.kind]}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-ink-2">{r.trade ?? "—"}</td>
                  <td className="px-4 py-2 text-ink-2 tabular">{r.phone ? <a href={`tel:${r.phone}`} className="hover:text-ink">{r.phone}</a> : "—"}</td>
                  <td className="px-4 py-2 text-ink-2">
                    {r.memberId && r.memberActive ? (
                      <span className="flex items-center gap-1">
                        <Smartphone className="size-3.5 text-success" />
                        {r.memberRole ? ROLE_LABELS[r.memberRole] : "Yes"}
                      </span>
                    ) : (
                      <span className="text-subtle">No login</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right tabular">{r.openTasks || <span className="text-subtle">0</span>}</td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-1">
                      {r.onSite && (
                        <Badge tone="green" title={`Checked in at ${r.onSite}`}>
                          <MapPin className="mr-0.5 size-3" />
                          On site
                        </Badge>
                      )}
                      {r.expired > 0 && <Badge tone="red">Cert expired</Badge>}
                      {r.expired === 0 && r.expiring > 0 && <Badge tone="amber">Cert expiring</Badge>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
      <Link href={archived ? "/app/team" : "/app/team?archived=1"} className="self-start text-[12.5px] text-ink-2 hover:text-ink">
        {archived ? "Back to the current team" : "Show people who've left"}
      </Link>
    </>
  );
}

function Week({ schedule, days, today }: { schedule: Awaited<ReturnType<typeof teamSchedule>>; days: string[]; today: string }) {
  if (schedule.team.length === 0) return <Panel className="px-6 py-10 text-center text-subtle">Add people to the team to see who&apos;s where.</Panel>;
  return (
    <Panel className="overflow-x-auto">
      <table className="w-full min-w-[980px] table-fixed">
        <thead className="border-b border-hairline text-left text-[12px]">
          <tr>
            <th className="w-[180px] px-3 py-2 font-medium text-subtle">Person</th>
            {days.map((d, i) => (
              <th key={d} className={cn("px-2 py-2 font-medium", d === today ? "text-brand" : "text-subtle", i >= 5 && "bg-surface-2")}>
                {weekday(d)} {shortDay(d)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {schedule.team.map((w) => {
            const mine = schedule.tasks.filter((t) => t.workerId === w.id);
            return (
              <tr key={w.id} className="border-b border-muted align-top last:border-0">
                <td className="px-3 py-2">
                  <Link href={`/app/team/${w.id}`} className="block truncate font-medium hover:underline">
                    {w.name}
                  </Link>
                  {w.trade && <div className="truncate text-[11.5px] text-subtle">{w.trade}</div>}
                </td>
                {days.map((d, i) => {
                  const on = mine.filter((t) => taskOnDay(t, d));
                  const jobs = [...new Map(on.map((t) => [t.projectId, t])).values()];
                  return (
                    <td key={d} className={cn("px-1.5 py-1.5", i >= 5 && "bg-surface-2")}>
                      <div className="flex flex-col gap-1">
                        {jobs.map((t) => {
                          const tasks = on.filter((x) => x.projectId === t.projectId);
                          return (
                            <Link
                              key={t.projectId}
                              href={`/app/projects/${t.projectId}?view=timeline`}
                              title={tasks.map((x) => x.title).join("\n")}
                              className="flex items-start gap-1.5 rounded-md bg-surface px-1.5 py-1 text-[11.5px] hover:bg-muted"
                            >
                              <span className={cn("mt-1 size-1.5 flex-none rounded-full", TASK_DOT[tasks.every((x) => x.status === "done") ? "done" : tasks.some((x) => x.status === "waiting") ? "waiting" : tasks.some((x) => x.status === "in_progress") ? "in_progress" : "todo"])} />
                              <span className="min-w-0">
                                <span className="block truncate font-medium">{t.projectName}</span>
                                <span className="block truncate text-subtle">{tasks.length === 1 ? tasks[0].title : `${tasks.length} tasks`}</span>
                              </span>
                            </Link>
                          );
                        })}
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="border-t border-hairline px-3 py-2 text-[12px] text-subtle">Built from task dates on current projects. Give a task a person and dates and it shows up here.</p>
    </Panel>
  );
}

function Hours({
  visits,
  team,
  days,
  today,
  canEdit,
}: {
  visits: Awaited<ReturnType<typeof listVisits>>;
  team: { id: string; name: string }[];
  days: string[];
  today: string;
  canEdit: boolean;
}) {
  const now = new Date();
  const sheet = timesheet(visits, days, now);
  const people = [...team.filter((w) => sheet.has(w.id)), ...[...new Map(visits.filter((v) => !team.some((w) => w.id === v.workerId)).map((v) => [v.workerId, { id: v.workerId, name: v.workerName }])).values()]];
  if (people.length === 0)
    return (
      <Panel className="px-6 py-10 text-center text-subtle">
        No check-ins this week. People check in and out on site from the site app on their phone, and their hours show up here.
      </Panel>
    );
  const dayTotals = days.map((_, i) => [...sheet.values()].reduce((s, r) => s + r.byDay[i], 0));
  return (
    <div className="flex flex-col gap-4">
      <Panel className="overflow-x-auto">
        <table className="w-full min-w-[860px] tabular">
          <thead className="border-b border-hairline text-left text-[12px] text-subtle">
            <tr>
              <th className="px-3 py-2 font-medium">Person</th>
              {days.map((d) => (
                <th key={d} className={cn("px-2 py-2 text-right font-medium", d === today && "text-brand")}>
                  {weekday(d)} {shortDay(d)}
                </th>
              ))}
              <th className="px-3 py-2 text-right font-medium">Week</th>
            </tr>
          </thead>
          <tbody>
            {people.map((w) => {
              const r = sheet.get(w.id)!;
              return (
                <tr key={w.id} className="border-b border-muted last:border-0">
                  <td className="px-3 py-2">
                    <Link href={`/app/team/${w.id}`} className="font-medium hover:underline">
                      {w.name}
                    </Link>
                    {r.open && <span className="ml-1.5 text-[11.5px] text-success">on site now</span>}
                  </td>
                  {r.byDay.map((m, i) => (
                    <td key={days[i]} className={cn("px-2 py-2 text-right", m === 0 && "text-faint-2")}>
                      {m ? formatMinutes(m) : "–"}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right font-semibold">{formatMinutes(r.total)}</td>
                </tr>
              );
            })}
            <tr className="border-t border-hairline bg-surface-2 text-[12.5px]">
              <td className="px-3 py-2 font-medium">Total</td>
              {dayTotals.map((m, i) => (
                <td key={days[i]} className="px-2 py-2 text-right text-ink-2">
                  {m ? formatMinutes(m) : "–"}
                </td>
              ))}
              <td className="px-3 py-2 text-right font-semibold">{formatMinutes(dayTotals.reduce((a, b) => a + b, 0))}</td>
            </tr>
          </tbody>
        </table>
      </Panel>

      <Panel className="overflow-x-auto">
        <h2 className="border-b border-hairline px-4 py-2.5 font-semibold">Check-ins</h2>
        <ul className="min-w-[780px]">
          {visits.map((v) => (
            <li key={v.id} className="grid grid-cols-[110px_minmax(0,1fr)_minmax(0,1.2fr)_180px_90px_70px] items-center gap-3 border-b border-muted px-4 py-2 last:border-0">
              <span className="text-ink-2">
                {weekday(londonDay(v.checkedInAt))} {shortDay(londonDay(v.checkedInAt))}
              </span>
              <Link href={`/app/team/${v.workerId}`} className="truncate font-medium hover:underline">
                {v.workerName}
              </Link>
              <Link href={`/app/projects/${v.projectId}`} className="truncate text-ink-2 hover:text-ink">
                {v.projectName}
              </Link>
              <VisitTimes visit={v} canEdit={canEdit} />
              <VisitPlaces visit={v} />
              <span className="text-right tabular">{formatMinutes(visitMinutes(v.checkedInAt, v.checkedOutAt, now))}</span>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
