/**
 * The team, office side: workers (with or without a login), their certificates, who's working where, and
 * timesheets from site check-ins. Runs in the tenant transaction like everything else.
 */
import "server-only";
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lt, lte, ne, sql } from "drizzle-orm";
import { addDays } from "@/core/payment-plan";
import type { CertificateInput, WorkerInput } from "@/core/schemas";
import type { Tx } from "./index";
import { members, organizations, projectTasks, projects, siteVisits, workerCertificates, workers } from "./schema";

export type TeamErrorReason = "not_found" | "member_taken" | "unknown_member" | "visit_end" | "visit_overlap";

export class TeamError extends Error {
  constructor(readonly reason: TeamErrorReason) {
    super(reason);
  }
}

const ACTIVE_PROJECT = ["booked", "on_site", "snagging", "on_hold"] as const;

// ── Workers ──────────────────────────────────────────────────────────────────

/** The team list: who, what they do, contact, login, open tasks and the state of their certificates. */
export async function listWorkers(tx: Tx, orgId: string, { archived = false, today }: { archived?: boolean; today: string }) {
  const rows = await tx
    .select({
      id: workers.id,
      name: workers.name,
      kind: workers.kind,
      trade: workers.trade,
      phone: workers.phone,
      email: workers.email,
      memberId: workers.memberId,
      memberRole: members.role,
      memberActive: members.active,
      openTasks: sql<number>`(select count(*) from project_tasks t where t.org_id = "workers"."org_id" and t.worker_id = "workers"."id" and t.status <> 'done')`.mapWith(Number),
      expired: sql<number>`(select count(*) from worker_certificates c where c.org_id = "workers"."org_id" and c.worker_id = "workers"."id" and c.expires_on < ${today})`.mapWith(Number),
      expiring: sql<number>`(select count(*) from worker_certificates c where c.org_id = "workers"."org_id" and c.worker_id = "workers"."id" and c.expires_on >= ${today} and c.expires_on <= ${addDays(today, 30)})`.mapWith(Number),
      onSite: sql<string | null>`(select p.name from site_visits v join projects p on p.org_id = v.org_id and p.id = v.project_id where v.org_id = "workers"."org_id" and v.worker_id = "workers"."id" and v.checked_out_at is null limit 1)`,
    })
    .from(workers)
    .leftJoin(members, and(eq(members.orgId, workers.orgId), eq(members.id, workers.memberId)))
    .where(and(eq(workers.orgId, orgId), archived ? isNotNull(workers.archivedAt) : isNull(workers.archivedAt)))
    .orderBy(asc(sql`lower(${workers.name})`));
  return rows;
}

export async function getWorker(tx: Tx, orgId: string, workerId: string) {
  const [row] = await tx
    .select({ worker: workers, memberName: members.name, memberRole: members.role, memberEmail: members.email, memberActive: members.active })
    .from(workers)
    .leftJoin(members, and(eq(members.orgId, workers.orgId), eq(members.id, workers.memberId)))
    .where(and(eq(workers.orgId, orgId), eq(workers.id, workerId)));
  if (!row) return undefined;
  const certificates = await tx
    .select({ id: workerCertificates.id, name: workerCertificates.name, reference: workerCertificates.reference, expiresOn: workerCertificates.expiresOn })
    .from(workerCertificates)
    .where(and(eq(workerCertificates.orgId, orgId), eq(workerCertificates.workerId, workerId)))
    .orderBy(sql`${workerCertificates.expiresOn} asc nulls last`, asc(workerCertificates.name));
  const tasks = await tx
    .select({
      id: projectTasks.id,
      title: projectTasks.title,
      status: projectTasks.status,
      startDate: projectTasks.startDate,
      dueDate: projectTasks.dueDate,
      projectId: projects.id,
      projectName: projects.name,
    })
    .from(projectTasks)
    .innerJoin(projects, and(eq(projects.orgId, projectTasks.orgId), eq(projects.id, projectTasks.projectId)))
    .where(and(eq(projectTasks.orgId, orgId), eq(projectTasks.workerId, workerId), ne(projectTasks.status, "done"), inArray(projects.status, [...ACTIVE_PROJECT])))
    .orderBy(sql`coalesce(${projectTasks.startDate}, ${projectTasks.dueDate}) asc nulls last`)
    .limit(200);
  return { ...row, certificates, tasks };
}

const workerValues = (input: WorkerInput) => ({
  name: input.name,
  kind: input.kind,
  trade: input.trade ?? null,
  phone: input.phone || null,
  email: input.email ?? null,
  dayRatePence: input.dayRatePence ?? null,
  startedOn: input.startedOn ?? null,
  emergencyName: input.emergencyName ?? null,
  emergencyPhone: input.emergencyPhone || null,
  notes: input.notes || null,
});

export async function createWorker(tx: Tx, orgId: string, input: WorkerInput): Promise<string> {
  const [row] = await tx.insert(workers).values({ orgId, ...workerValues(input) }).returning({ id: workers.id });
  return row.id;
}

/**
 * Update a worker's details. `canSeeCosts` false leaves the day rate as it is (people who can't see it
 * can't clear it by saving the form either).
 */
export async function updateWorker(tx: Tx, orgId: string, workerId: string, input: WorkerInput, canSeeCosts: boolean) {
  const { dayRatePence, ...rest } = workerValues(input);
  const rows = await tx
    .update(workers)
    .set(canSeeCosts ? { ...rest, dayRatePence } : rest)
    .where(and(eq(workers.orgId, orgId), eq(workers.id, workerId)))
    .returning({ id: workers.id });
  if (rows.length === 0) throw new TeamError("not_found");
}

/** Archive someone who's left (their history stays), or bring them back. Archiving unassigns open tasks. */
export async function setWorkerArchived(tx: Tx, orgId: string, workerId: string, archived: boolean) {
  const rows = await tx
    .update(workers)
    .set({ archivedAt: archived ? new Date() : null })
    .where(and(eq(workers.orgId, orgId), eq(workers.id, workerId)))
    .returning({ id: workers.id });
  if (rows.length === 0) throw new TeamError("not_found");
  if (archived) {
    await tx
      .update(projectTasks)
      .set({ workerId: null })
      .where(and(eq(projectTasks.orgId, orgId), eq(projectTasks.workerId, workerId), ne(projectTasks.status, "done")));
    await tx
      .update(siteVisits)
      .set({ checkedOutAt: new Date() })
      .where(and(eq(siteVisits.orgId, orgId), eq(siteVisits.workerId, workerId), isNull(siteVisits.checkedOutAt)));
  }
}

/** Logins not yet linked to anyone on the team. */
export async function unlinkedMembers(tx: Tx, orgId: string) {
  return tx
    .select({ id: members.id, name: members.name, email: members.email, role: members.role })
    .from(members)
    .where(and(eq(members.orgId, orgId), eq(members.active, true), sql`not exists (select 1 from workers w where w.org_id = ${orgId} and w.member_id = "members"."id")`))
    .orderBy(asc(members.name));
}

/** Link a worker to a login (so they can use the site app), or unlink (null). */
export async function linkWorker(tx: Tx, orgId: string, workerId: string, memberId: string | null) {
  if (memberId) {
    const [m] = await tx.select({ id: members.id }).from(members).where(and(eq(members.orgId, orgId), eq(members.id, memberId)));
    if (!m) throw new TeamError("unknown_member");
    const [taken] = await tx.select({ id: workers.id }).from(workers).where(and(eq(workers.orgId, orgId), eq(workers.memberId, memberId), ne(workers.id, workerId)));
    if (taken) throw new TeamError("member_taken");
  }
  const rows = await tx.update(workers).set({ memberId }).where(and(eq(workers.orgId, orgId), eq(workers.id, workerId))).returning({ id: workers.id });
  if (rows.length === 0) throw new TeamError("not_found");
}

/**
 * Make sure a login is on the team. Called when a member is synced from Clerk: links an existing,
 * unlinked worker with the same email if there is one, otherwise adds a new worker.
 */
export async function ensureWorkerForMember(tx: Tx, orgId: string, member: { id: string; name: string; email: string | null }) {
  const [linked] = await tx.select({ id: workers.id }).from(workers).where(and(eq(workers.orgId, orgId), eq(workers.memberId, member.id)));
  if (linked) return linked.id;
  if (member.email) {
    // An unlinked, current worker with the same email (the oldest, if two share it) becomes this login's.
    const [match] = await tx
      .select({ id: workers.id })
      .from(workers)
      .where(and(eq(workers.orgId, orgId), isNull(workers.memberId), isNull(workers.archivedAt), sql`lower(${workers.email}) = lower(${member.email})`))
      .orderBy(asc(workers.createdAt))
      .limit(1);
    if (match) {
      await tx.update(workers).set({ memberId: member.id }).where(and(eq(workers.orgId, orgId), eq(workers.id, match.id)));
      return match.id;
    }
  }
  const inserted = await tx.insert(workers).values({ orgId, memberId: member.id, name: member.name.slice(0, 200), email: member.email }).onConflictDoNothing().returning({ id: workers.id });
  if (inserted[0]) return inserted[0].id;
  const [again] = await tx.select({ id: workers.id }).from(workers).where(and(eq(workers.orgId, orgId), eq(workers.memberId, member.id)));
  return again?.id ?? null;
}

// ── Certificates ─────────────────────────────────────────────────────────────

async function assertWorker(tx: Tx, orgId: string, workerId: string) {
  const [w] = await tx.select({ id: workers.id }).from(workers).where(and(eq(workers.orgId, orgId), eq(workers.id, workerId)));
  if (!w) throw new TeamError("not_found");
}

export async function addCertificate(tx: Tx, orgId: string, workerId: string, input: CertificateInput): Promise<string> {
  await assertWorker(tx, orgId, workerId);
  const [row] = await tx
    .insert(workerCertificates)
    .values({ orgId, workerId, name: input.name, reference: input.reference ?? null, expiresOn: input.expiresOn ?? null })
    .returning({ id: workerCertificates.id });
  return row.id;
}

/** Update a certificate. A new expiry date (a renewal) means the reminder can go out again next time. */
export async function updateCertificate(tx: Tx, orgId: string, workerId: string, certificateId: string, input: CertificateInput) {
  const rows = await tx
    .update(workerCertificates)
    .set({
      name: input.name,
      reference: input.reference ?? null,
      expiresOn: input.expiresOn ?? null,
      remindedAt: sql`case when ${workerCertificates.expiresOn} is not distinct from ${input.expiresOn ?? null}::date then ${workerCertificates.remindedAt} else null end`,
    })
    .where(and(eq(workerCertificates.orgId, orgId), eq(workerCertificates.workerId, workerId), eq(workerCertificates.id, certificateId)))
    .returning({ id: workerCertificates.id });
  if (rows.length === 0) throw new TeamError("not_found");
}

export async function deleteCertificate(tx: Tx, orgId: string, workerId: string, certificateId: string) {
  const rows = await tx
    .delete(workerCertificates)
    .where(and(eq(workerCertificates.orgId, orgId), eq(workerCertificates.workerId, workerId), eq(workerCertificates.id, certificateId)))
    .returning({ id: workerCertificates.id });
  if (rows.length === 0) throw new TeamError("not_found");
}

/** Certificates of current workers that expire by `until` and haven't been reminded about. */
export async function certificatesToRemind(tx: Tx, orgId: string, until: string) {
  return tx
    .select({ id: workerCertificates.id, name: workerCertificates.name, expiresOn: workerCertificates.expiresOn, workerName: workers.name, workerId: workers.id })
    .from(workerCertificates)
    .innerJoin(workers, and(eq(workers.orgId, workerCertificates.orgId), eq(workers.id, workerCertificates.workerId)))
    .where(and(eq(workerCertificates.orgId, orgId), lte(workerCertificates.expiresOn, until), isNull(workerCertificates.remindedAt), isNull(workers.archivedAt)))
    .orderBy(asc(workerCertificates.expiresOn));
}

/** Who hears about expiring certificates (active admins and office), and the company name for the email. */
export async function certificateReminderContext(tx: Tx, orgId: string) {
  const [org] = await tx.select({ name: organizations.name, tradingName: organizations.tradingName, brandColour: organizations.brandColour }).from(organizations).where(eq(organizations.id, orgId));
  const people = await tx
    .select({ email: members.email })
    .from(members)
    .where(and(eq(members.orgId, orgId), eq(members.active, true), inArray(members.role, ["admin", "office"]), isNotNull(members.email)));
  return { company: org?.tradingName ?? org?.name ?? "", brandColour: org?.brandColour ?? null, to: [...new Set(people.flatMap((p) => (p.email ? [p.email] : [])))] };
}

export async function markCertificatesReminded(tx: Tx, orgId: string, ids: string[]) {
  if (ids.length === 0) return;
  await tx.update(workerCertificates).set({ remindedAt: new Date() }).where(and(eq(workerCertificates.orgId, orgId), inArray(workerCertificates.id, ids)));
}

/** Certificates expiring within 30 days or already expired, for the dashboard and team page. */
export async function certificateAlerts(tx: Tx, orgId: string, today: string) {
  return tx
    .select({ id: workerCertificates.id, name: workerCertificates.name, expiresOn: workerCertificates.expiresOn, workerId: workers.id, workerName: workers.name })
    .from(workerCertificates)
    .innerJoin(workers, and(eq(workers.orgId, workerCertificates.orgId), eq(workers.id, workerCertificates.workerId)))
    .where(and(eq(workerCertificates.orgId, orgId), lte(workerCertificates.expiresOn, addDays(today, 30)), isNull(workers.archivedAt)))
    .orderBy(asc(workerCertificates.expiresOn))
    .limit(50);
}

// ── Who's where, and timesheets ──────────────────────────────────────────────

/**
 * The week's plan: for each current worker, the tasks (on active projects) whose dates fall in the 7 days
 * from `weekStart`. Tasks without dates aren't on the plan.
 */
export async function teamSchedule(tx: Tx, orgId: string, weekStart: string) {
  const weekEnd = addDays(weekStart, 6);
  const team = await tx
    .select({ id: workers.id, name: workers.name, trade: workers.trade })
    .from(workers)
    .where(and(eq(workers.orgId, orgId), isNull(workers.archivedAt)))
    .orderBy(asc(sql`lower(${workers.name})`));
  const tasks = await tx
    .select({
      id: projectTasks.id,
      workerId: projectTasks.workerId,
      title: projectTasks.title,
      status: projectTasks.status,
      startDate: projectTasks.startDate,
      dueDate: projectTasks.dueDate,
      projectId: projects.id,
      projectName: projects.name,
    })
    .from(projectTasks)
    .innerJoin(projects, and(eq(projects.orgId, projectTasks.orgId), eq(projects.id, projectTasks.projectId)))
    .where(
      and(
        eq(projectTasks.orgId, orgId),
        isNotNull(projectTasks.workerId),
        inArray(projects.status, [...ACTIVE_PROJECT]),
        // Overlaps the week: starts (or is due) by the end, and ends (or starts) after the start.
        sql`coalesce(${projectTasks.startDate}, ${projectTasks.dueDate}) <= ${weekEnd}`,
        sql`coalesce(${projectTasks.dueDate}, ${projectTasks.startDate}) >= ${weekStart}`,
      ),
    );
  return { team, tasks };
}

/** Site visits between two dates (inclusive), for timesheets. Optionally one worker. */
export async function listVisits(tx: Tx, orgId: string, { from, to, workerId }: { from: string; to: string; workerId?: string }) {
  return tx
    .select({
      id: siteVisits.id,
      workerId: siteVisits.workerId,
      workerName: workers.name,
      projectId: projects.id,
      projectName: projects.name,
      checkedInAt: siteVisits.checkedInAt,
      checkedOutAt: siteVisits.checkedOutAt,
      inLat: siteVisits.inLat,
      inLng: siteVisits.inLng,
      outLat: siteVisits.outLat,
      outLng: siteVisits.outLng,
      editedAt: siteVisits.editedAt,
      editedByName: members.name,
    })
    .from(siteVisits)
    .leftJoin(members, and(eq(members.orgId, siteVisits.orgId), eq(members.id, siteVisits.editedByMemberId)))
    .innerJoin(workers, and(eq(workers.orgId, siteVisits.orgId), eq(workers.id, siteVisits.workerId)))
    .innerJoin(projects, and(eq(projects.orgId, siteVisits.orgId), eq(projects.id, siteVisits.projectId)))
    .where(
      and(
        eq(siteVisits.orgId, orgId),
        workerId ? eq(siteVisits.workerId, workerId) : undefined,
        gte(siteVisits.checkedInAt, sql`(${from}::date)::timestamp at time zone 'Europe/London'`),
        lt(siteVisits.checkedInAt, sql`(${addDays(to, 1)}::date)::timestamp at time zone 'Europe/London'`),
      ),
    )
    .orderBy(desc(siteVisits.checkedInAt))
    .limit(2_000);
}

/**
 * The office corrects a visit's times (a forgotten check-out, a phone that died). A finished visit must
 * keep a leaving time; an open one may be closed. The corrected times can't overlap the person's other
 * visits. Records who made the change and when.
 */
export async function editVisit(tx: Tx, orgId: string, visitId: string, editorMemberId: string, times: { checkedInAt: Date; checkedOutAt: Date | null }) {
  const [visit] = await tx
    .select({ workerId: siteVisits.workerId, checkedOutAt: siteVisits.checkedOutAt })
    .from(siteVisits)
    .where(and(eq(siteVisits.orgId, orgId), eq(siteVisits.id, visitId)))
    .for("update");
  if (!visit) throw new TeamError("not_found");
  if (visit.checkedOutAt && !times.checkedOutAt) throw new TeamError("visit_end");
  const [clash] = await tx
    .select({ id: siteVisits.id })
    .from(siteVisits)
    .where(
      and(
        eq(siteVisits.orgId, orgId),
        eq(siteVisits.workerId, visit.workerId),
        ne(siteVisits.id, visitId),
        times.checkedOutAt ? lt(siteVisits.checkedInAt, times.checkedOutAt) : undefined,
        sql`coalesce(${siteVisits.checkedOutAt}, 'infinity'::timestamptz) > ${times.checkedInAt.toISOString()}::timestamptz`,
      ),
    )
    .limit(1);
  if (clash) throw new TeamError("visit_overlap");
  await tx
    .update(siteVisits)
    .set({ checkedInAt: times.checkedInAt, checkedOutAt: times.checkedOutAt, editedAt: new Date(), editedByMemberId: editorMemberId })
    .where(and(eq(siteVisits.orgId, orgId), eq(siteVisits.id, visitId)));
}
