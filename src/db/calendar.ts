/**
 * The calendar: what's happening on which day. Survey visits booked with leads, task start and due dates
 * (by worker), and jobs starting or due to finish. Dates are UK days; visit times are UK clock times.
 */
import "server-only";
import { and, asc, eq, gte, isNotNull, lte, ne, or, sql } from "drizzle-orm";
import type { TaskStatus } from "@/core/projects";
import type { Tx } from "./index";
import { leads, projectTasks, projects, workers } from "./schema";

export type CalendarKind = "visit" | "task" | "job_start" | "job_end";
export type CalendarItem = {
  key: string;
  kind: CalendarKind;
  /** YYYY-MM-DD, UK. */
  day: string;
  /** HH:MM, UK; visits only. */
  time: string | null;
  title: string;
  detail: string | null;
  href: string;
  workerId: string | null;
  worker: string | null;
  status: TaskStatus | null;
  /** For a task spanning days: "start" or "due" marks which end this is. */
  end: "start" | "due" | null;
};

export async function calendarItems(tx: Tx, orgId: string, from: string, to: string, opts: { leads: boolean; workerId?: string }): Promise<CalendarItem[]> {
  const items: CalendarItem[] = [];

  if (opts.leads && !opts.workerId) {
    const day = sql<string>`to_char(${leads.visitAt} at time zone 'Europe/London', 'YYYY-MM-DD')`;
    const rows = await tx
      .select({ id: leads.id, name: leads.name, postcode: leads.postcode, projectType: leads.projectType, day, time: sql<string>`to_char(${leads.visitAt} at time zone 'Europe/London', 'HH24:MI')` })
      .from(leads)
      .where(and(eq(leads.orgId, orgId), isNotNull(leads.visitAt), gte(day, from), lte(day, to), ne(leads.stage, "lost")))
      .orderBy(asc(leads.visitAt));
    for (const r of rows)
      items.push({ key: `v:${r.id}`, kind: "visit", day: r.day, time: r.time, title: `Survey: ${r.name}`, detail: [r.projectType, r.postcode].filter(Boolean).join(" · ") || null, href: `/app/pipeline/${r.id}`, workerId: null, worker: null, status: null, end: null });
  }

  const inRange = (col: typeof projectTasks.startDate | typeof projectTasks.dueDate) => and(gte(col, from), lte(col, to));
  const tasks = await tx
    .select({
      id: projectTasks.id,
      title: projectTasks.title,
      status: projectTasks.status,
      startDate: projectTasks.startDate,
      dueDate: projectTasks.dueDate,
      projectId: projects.id,
      project: projects.name,
      workerId: workers.id,
      worker: workers.name,
    })
    .from(projectTasks)
    .innerJoin(projects, and(eq(projects.orgId, projectTasks.orgId), eq(projects.id, projectTasks.projectId)))
    .leftJoin(workers, and(eq(workers.orgId, projectTasks.orgId), eq(workers.id, projectTasks.workerId)))
    .where(and(eq(projectTasks.orgId, orgId), or(inRange(projectTasks.startDate), inRange(projectTasks.dueDate)), opts.workerId ? eq(projectTasks.workerId, opts.workerId) : undefined))
    .orderBy(asc(projects.name), asc(projectTasks.position));
  for (const t of tasks) {
    const base = { kind: "task" as const, time: null, title: t.title, detail: t.project, href: `/app/projects/${t.projectId}?view=list`, workerId: t.workerId, worker: t.worker, status: t.status };
    const one = t.startDate && t.dueDate && t.startDate !== t.dueDate ? null : (t.dueDate ?? t.startDate);
    if (one) {
      if (one >= from && one <= to) items.push({ ...base, key: `t:${t.id}`, day: one, end: null });
      continue;
    }
    if (t.startDate! >= from && t.startDate! <= to) items.push({ ...base, key: `t:${t.id}:s`, day: t.startDate!, end: "start" });
    if (t.dueDate! >= from && t.dueDate! <= to) items.push({ ...base, key: `t:${t.id}:d`, day: t.dueDate!, end: "due" });
  }

  if (!opts.workerId) {
    const jobs = await tx
      .select({ id: projects.id, name: projects.name, status: projects.status, startDate: projects.startDate, endDate: projects.endDate })
      .from(projects)
      .where(and(eq(projects.orgId, orgId), or(and(gte(projects.startDate, from), lte(projects.startDate, to)), and(gte(projects.endDate, from), lte(projects.endDate, to)))));
    for (const j of jobs) {
      const href = `/app/projects/${j.id}`;
      if (j.startDate && j.startDate >= from && j.startDate <= to)
        items.push({ key: `js:${j.id}`, kind: "job_start", day: j.startDate, time: null, title: `Job starts: ${j.name}`, detail: null, href, workerId: null, worker: null, status: null, end: null });
      if (j.endDate && j.endDate >= from && j.endDate <= to && j.status !== "complete")
        items.push({ key: `je:${j.id}`, kind: "job_end", day: j.endDate, time: null, title: `Due to finish: ${j.name}`, detail: null, href, workerId: null, worker: null, status: null, end: null });
    }
  }

  const order: Record<CalendarKind, number> = { job_start: 0, job_end: 1, visit: 2, task: 3 };
  return items.sort((a, b) => a.day.localeCompare(b.day) || order[a.kind] - order[b.kind] || (a.time ?? "").localeCompare(b.time ?? ""));
}
