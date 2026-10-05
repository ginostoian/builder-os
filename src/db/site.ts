/**
 * The site app: what one worker sees and does on their phone. Everything is scoped to the signed-in
 * person's worker record. They see the active jobs they have tasks on (or run), change their own tasks,
 * post to those jobs' diaries, and check in and out. Never prices, other jobs, or other people's notes.
 */
import "server-only";
import { and, asc, desc, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";
import type { TaskStatus } from "@/core/projects";
import type { Tx } from "./index";
import { clients, projectDiary, projectPhases, projectTasks, projects, siteSyncOps, siteVisits, workers } from "./schema";

export type SiteErrorReason = "no_worker" | "not_found" | "not_yours";

export class SiteError extends Error {
  constructor(readonly reason: SiteErrorReason) {
    super(reason);
  }
}

const ACTIVE = ["booked", "on_site", "snagging", "on_hold"] as const;

/** The signed-in person's worker record, if they're on the team (and not archived). */
export async function workerForMember(tx: Tx, orgId: string, memberId: string) {
  const [w] = await tx
    .select({ id: workers.id, name: workers.name, trade: workers.trade })
    .from(workers)
    .where(and(eq(workers.orgId, orgId), eq(workers.memberId, memberId), isNull(workers.archivedAt)));
  return w;
}

/** Active projects this person works on: they have a task there, or they run it. */
function myProjectFilter(orgId: string, workerId: string, memberId: string) {
  return and(
    eq(projects.orgId, orgId),
    inArray(projects.status, [...ACTIVE]),
    or(
      eq(projects.managerMemberId, memberId),
      sql`exists (select 1 from project_tasks t where t.org_id = ${orgId} and t.project_id = "projects"."id" and t.worker_id = ${workerId})`,
    ),
  );
}

export async function myJobs(tx: Tx, orgId: string, me: { workerId: string; memberId: string }) {
  return tx
    .select({
      id: projects.id,
      name: projects.name,
      status: projects.status,
      siteAddress: projects.siteAddress,
      clientName: clients.name,
      openTasks: sql<number>`(select count(*) from project_tasks t where t.org_id = ${orgId} and t.project_id = "projects"."id" and t.worker_id = ${me.workerId} and t.status <> 'done')`.mapWith(Number),
    })
    .from(projects)
    .innerJoin(clients, and(eq(clients.orgId, projects.orgId), eq(clients.id, projects.clientId)))
    .where(myProjectFilter(orgId, me.workerId, me.memberId))
    .orderBy(sql`${projects.startDate} asc nulls last`, asc(projects.name));
}

/** My unfinished tasks on active jobs (plus anything I finished today), soonest first. */
export async function myTasks(tx: Tx, orgId: string, workerId: string) {
  return tx
    .select({
      id: projectTasks.id,
      title: projectTasks.title,
      notes: projectTasks.notes,
      status: projectTasks.status,
      startDate: projectTasks.startDate,
      dueDate: projectTasks.dueDate,
      projectId: projects.id,
      projectName: projects.name,
      phaseName: projectPhases.name,
    })
    .from(projectTasks)
    .innerJoin(projects, and(eq(projects.orgId, projectTasks.orgId), eq(projects.id, projectTasks.projectId)))
    .leftJoin(projectPhases, and(eq(projectPhases.orgId, projectTasks.orgId), eq(projectPhases.id, projectTasks.phaseId)))
    .where(
      and(
        eq(projectTasks.orgId, orgId),
        eq(projectTasks.workerId, workerId),
        inArray(projects.status, [...ACTIVE]),
        or(ne(projectTasks.status, "done"), sql`${projectTasks.completedAt} >= date_trunc('day', now() at time zone 'Europe/London') at time zone 'Europe/London'`),
      ),
    )
    .orderBy(sql`coalesce(${projectTasks.startDate}, ${projectTasks.dueDate}) asc nulls last`, asc(projectTasks.position))
    .limit(300);
}

/** One job, if it's one of mine: the details I need on site, my tasks there, and recent shared updates. */
export async function myJob(tx: Tx, orgId: string, me: { workerId: string; memberId: string }, projectId: string) {
  const [p] = await tx
    .select({
      id: projects.id,
      name: projects.name,
      status: projects.status,
      siteAddress: projects.siteAddress,
      startDate: projects.startDate,
      endDate: projects.endDate,
      clientName: clients.name,
      clientPhone: clients.phone,
    })
    .from(projects)
    .innerJoin(clients, and(eq(clients.orgId, projects.orgId), eq(clients.id, projects.clientId)))
    .where(and(myProjectFilter(orgId, me.workerId, me.memberId), eq(projects.id, projectId)));
  if (!p) return undefined;
  const tasks = (await myTasks(tx, orgId, me.workerId)).filter((t) => t.projectId === projectId);
  const diary = await tx
    .select({ id: projectDiary.id, entryDate: projectDiary.entryDate, body: projectDiary.body, photos: projectDiary.photos, createdAt: projectDiary.createdAt })
    .from(projectDiary)
    .where(and(eq(projectDiary.orgId, orgId), eq(projectDiary.projectId, projectId)))
    .orderBy(desc(projectDiary.entryDate), desc(projectDiary.createdAt))
    .limit(10);
  return { ...p, tasks, diary };
}

/** Change one of my tasks. "Waiting" adds the reason to the task's notes, dated, for the office. */
export async function setMyTaskStatus(tx: Tx, orgId: string, workerId: string, taskId: string, status: TaskStatus, reason: string | undefined, today: string, at?: Date) {
  const note = status === "waiting" && reason ? `${today}: waiting (${reason})` : null;
  const rows = await tx
    .update(projectTasks)
    .set({
      status,
      completedAt: status === "done" ? sql`coalesce(${projectTasks.completedAt}, ${at ? sql`${at.toISOString()}::timestamptz` : sql`now()`})` : null,
      ...(note ? { notes: sql`left(coalesce(${projectTasks.notes} || E'\\n', '') || ${note}, 2000)` } : {}),
    })
    .where(and(eq(projectTasks.orgId, orgId), eq(projectTasks.workerId, workerId), eq(projectTasks.id, taskId)))
    .returning({ id: projectTasks.id, projectId: projectTasks.projectId });
  if (rows.length === 0) throw new SiteError("not_yours");
  return rows[0].projectId;
}

// ── Check in / out ───────────────────────────────────────────────────────────

export async function openVisit(tx: Tx, orgId: string, workerId: string) {
  const [v] = await tx
    .select({ id: siteVisits.id, projectId: siteVisits.projectId, projectName: projects.name, checkedInAt: siteVisits.checkedInAt })
    .from(siteVisits)
    .innerJoin(projects, and(eq(projects.orgId, siteVisits.orgId), eq(projects.id, siteVisits.projectId)))
    .where(and(eq(siteVisits.orgId, orgId), eq(siteVisits.workerId, workerId), isNull(siteVisits.checkedOutAt)));
  return v;
}

type Geo = { lat: number; lng: number } | undefined;

/** When it happened: the phone's clock for something done with no signal and sent later (`queued`). */
type Offline = { at: Date; queued: boolean } | undefined;

/** Check in to one of my jobs. Already checked in somewhere else? That visit is closed first. */
export async function checkIn(tx: Tx, orgId: string, me: { workerId: string; memberId: string }, projectId: string, geo: Geo, offline?: Offline) {
  const [mine] = await tx.select({ id: projects.id }).from(projects).where(and(myProjectFilter(orgId, me.workerId, me.memberId), eq(projects.id, projectId)));
  if (!mine) throw new SiteError("not_yours");
  await checkOut(tx, orgId, me.workerId, undefined, offline);
  const [w] = await tx.select({ dayRatePence: workers.dayRatePence }).from(workers).where(and(eq(workers.orgId, orgId), eq(workers.id, me.workerId)));
  await tx.insert(siteVisits).values({
    orgId,
    workerId: me.workerId,
    projectId,
    dayRatePence: w?.dayRatePence ?? null,
    inLat: geo ? String(geo.lat) : null,
    inLng: geo ? String(geo.lng) : null,
    ...(offline?.queued ? { checkedInAt: offline.at, recordedOffline: true } : {}),
  });
}

/** Close my open visit. Sent late from a phone that had no signal, it can't end before it started. */
export async function checkOut(tx: Tx, orgId: string, workerId: string, geo: Geo, offline?: Offline) {
  return tx
    .update(siteVisits)
    .set({
      checkedOutAt: offline?.queued ? sql`greatest(${siteVisits.checkedInAt}, ${offline.at.toISOString()}::timestamptz)` : new Date(),
      outLat: geo ? String(geo.lat) : null,
      outLng: geo ? String(geo.lng) : null,
      ...(offline?.queued ? { recordedOffline: true } : {}),
    })
    .where(and(eq(siteVisits.orgId, orgId), eq(siteVisits.workerId, workerId), isNull(siteVisits.checkedOutAt)))
    .returning({ id: siteVisits.id });
}

/**
 * Claims a change sent from the phone's offline outbox. Returns null the first time (go ahead), or what
 * the first send recorded if it's a resend (do nothing; `resultId` is the update or receipt it made).
 */
export async function claimSyncOp(tx: Tx, orgId: string, memberId: string, opId: string): Promise<{ resultId: string | null } | null> {
  const inserted = await tx.insert(siteSyncOps).values({ orgId, id: opId, memberId }).onConflictDoNothing().returning({ id: siteSyncOps.id });
  if (inserted.length) return null;
  const [done] = await tx
    .select({ resultId: siteSyncOps.resultId, memberId: siteSyncOps.memberId })
    .from(siteSyncOps)
    .where(and(eq(siteSyncOps.orgId, orgId), eq(siteSyncOps.id, opId)));
  // Someone else's id: refuse rather than tell them anything about it.
  if (!done || done.memberId !== memberId) throw new SiteError("not_found");
  return { resultId: done.resultId };
}

export async function recordSyncResult(tx: Tx, orgId: string, opId: string, resultId: string) {
  await tx.update(siteSyncOps).set({ resultId }).where(and(eq(siteSyncOps.orgId, orgId), eq(siteSyncOps.id, opId)));
}

/** Whether a project is one of mine (for posting diary updates and photos from the site app). */
export async function isMyJob(tx: Tx, orgId: string, me: { workerId: string; memberId: string }, projectId: string) {
  const [p] = await tx.select({ id: projects.id }).from(projects).where(and(myProjectFilter(orgId, me.workerId, me.memberId), eq(projects.id, projectId)));
  return Boolean(p);
}
