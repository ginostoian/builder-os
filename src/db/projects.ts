/**
 * Projects: stages, tasks, the site diary and files, team side and client side. Runs in the tenant
 * transaction like everything else. Every task, stage, diary entry and file is checked to belong to the
 * project named, so one request can never reach into another project.
 */
import "server-only";
import { and, asc, count, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { MAX_DIARY_PHOTOS, MAX_PHASES_PER_PROJECT, MAX_TASKS_PER_PROJECT, type TaskStatus } from "@/core/projects";
import type { QuoteSnapshot } from "@/core/quote-snapshot";
import type { DiaryInput, ProjectInput, TaskInput } from "@/core/schemas";
import type { Tx } from "./index";
import { clients, invoices, members, projectDiary, projectFiles, projectPhases, projectTasks, projects, quoteDecisions, quoteVersions, quotes, variations } from "./schema";

export type ProjectErrorReason = "not_found" | "not_accepted" | "exists" | "unknown_client" | "unknown_member" | "unknown_phase" | "too_many" | "too_many_photos";

export class ProjectError extends Error {
  constructor(
    readonly reason: ProjectErrorReason,
    readonly projectId?: string,
  ) {
    super(reason);
  }
}

const ACTIVE = ["booked", "on_site", "snagging", "on_hold"] as const;

// ── Projects ─────────────────────────────────────────────────────────────────

async function assertClient(tx: Tx, orgId: string, clientId: string) {
  const [c] = await tx.select({ id: clients.id }).from(clients).where(and(eq(clients.orgId, orgId), eq(clients.id, clientId)));
  if (!c) throw new ProjectError("unknown_client");
}

async function assertMember(tx: Tx, orgId: string, memberId: string | undefined) {
  if (!memberId) return;
  const [m] = await tx.select({ id: members.id }).from(members).where(and(eq(members.orgId, orgId), eq(members.id, memberId), eq(members.active, true)));
  if (!m) throw new ProjectError("unknown_member");
}

/** The team members a task or project can be given to. */
export async function assignableMembers(tx: Tx, orgId: string) {
  return tx.select({ id: members.id, name: members.name, role: members.role }).from(members).where(and(eq(members.orgId, orgId), eq(members.active, true))).orderBy(asc(members.name));
}

export async function createProject(tx: Tx, orgId: string, input: ProjectInput, memberId: string): Promise<string> {
  await assertClient(tx, orgId, input.clientId);
  await assertMember(tx, orgId, input.managerMemberId);
  const [row] = await tx
    .insert(projects)
    .values({
      orgId,
      clientId: input.clientId,
      name: input.name,
      siteAddress: input.siteAddress ?? null,
      status: input.status,
      startDate: input.startDate ?? null,
      endDate: input.endDate ?? null,
      managerMemberId: input.managerMemberId ?? null,
      shareProgress: input.shareProgress,
      createdByMemberId: memberId,
    })
    .returning({ id: projects.id });
  return row.id;
}

/** The project started from a quote, if there is one. */
export async function projectForQuote(tx: Tx, orgId: string, quoteId: string): Promise<string | null> {
  const [p] = await tx.select({ id: projects.id }).from(projects).where(and(eq(projects.orgId, orgId), eq(projects.quoteId, quoteId)));
  return p?.id ?? null;
}

/**
 * Start a project from an accepted quote: its stages are the sections the client accepted, and optionally
 * each line becomes a task. One project per quote.
 */
export async function createProjectFromQuote(tx: Tx, orgId: string, input: { quoteId: string; tasksFromLines: boolean; startDate?: string }, memberId: string): Promise<string> {
  const existing = await projectForQuote(tx, orgId, input.quoteId);
  if (existing) throw new ProjectError("exists", existing);
  const [q] = await tx
    .select({ clientId: quotes.clientId, title: quotes.title, siteAddress: quotes.siteAddress, snapshot: quoteVersions.snapshot, clientAddress: clients.address })
    .from(quotes)
    .innerJoin(quoteDecisions, and(eq(quoteDecisions.orgId, quotes.orgId), eq(quoteDecisions.quoteId, quotes.id), eq(quoteDecisions.decision, "accepted")))
    .innerJoin(quoteVersions, and(eq(quoteVersions.orgId, quoteDecisions.orgId), eq(quoteVersions.id, quoteDecisions.versionId)))
    .innerJoin(clients, and(eq(clients.orgId, quotes.orgId), eq(clients.id, quotes.clientId)))
    .where(and(eq(quotes.orgId, orgId), eq(quotes.id, input.quoteId), eq(quotes.status, "accepted")));
  if (!q) throw new ProjectError("not_accepted");
  const snapshot = q.snapshot as QuoteSnapshot;
  const inserted = await tx
    .insert(projects)
    .values({ orgId, clientId: q.clientId, quoteId: input.quoteId, name: q.title, siteAddress: q.siteAddress ?? q.clientAddress ?? null, startDate: input.startDate ?? null, createdByMemberId: memberId })
    .onConflictDoNothing()
    .returning({ id: projects.id });
  if (inserted.length === 0) throw new ProjectError("exists", (await projectForQuote(tx, orgId, input.quoteId)) ?? undefined);
  const projectId = inserted[0].id;
  const sections = snapshot.sections.slice(0, MAX_PHASES_PER_PROJECT);
  if (sections.length > 0) {
    const phases = await tx
      .insert(projectPhases)
      .values(sections.map((s, i) => ({ orgId, projectId, name: s.name.slice(0, 200), position: i })))
      .returning({ id: projectPhases.id, position: projectPhases.position });
    if (input.tasksFromLines) {
      const byPosition = new Map(phases.map((p) => [p.position, p.id]));
      const rows = sections.flatMap((s, i) => s.lines.map((l) => ({ phaseId: byPosition.get(i)!, title: l.name })));
      const tasks = rows.slice(0, MAX_TASKS_PER_PROJECT).map((r, position) => ({ orgId, projectId, phaseId: r.phaseId, title: r.title, position, createdByMemberId: memberId }));
      if (tasks.length) await tx.insert(projectTasks).values(tasks);
    }
  }
  return projectId;
}

export async function updateProject(tx: Tx, orgId: string, projectId: string, input: ProjectInput) {
  await assertClient(tx, orgId, input.clientId);
  await assertMember(tx, orgId, input.managerMemberId);
  const rows = await tx
    .update(projects)
    .set({
      name: input.name,
      clientId: input.clientId,
      siteAddress: input.siteAddress ?? null,
      status: input.status,
      startDate: input.startDate ?? null,
      endDate: input.endDate ?? null,
      managerMemberId: input.managerMemberId ?? null,
      shareProgress: input.shareProgress,
      completedAt: input.status === "complete" ? sql`coalesce(${projects.completedAt}, now())` : null,
    })
    .where(and(eq(projects.orgId, orgId), eq(projects.id, projectId)))
    .returning({ id: projects.id });
  if (rows.length === 0) throw new ProjectError("not_found");
}

/** Delete a project with its stages, tasks, diary and files. Returns the storage keys to delete. */
export async function deleteProject(tx: Tx, orgId: string, projectId: string): Promise<string[]> {
  const keys = await projectStorageKeys(tx, orgId, projectId);
  const rows = await tx.delete(projects).where(and(eq(projects.orgId, orgId), eq(projects.id, projectId))).returning({ id: projects.id });
  if (rows.length === 0) throw new ProjectError("not_found");
  return keys;
}

async function projectStorageKeys(tx: Tx, orgId: string, projectId: string) {
  const files = await tx.select({ key: projectFiles.storageKey }).from(projectFiles).where(and(eq(projectFiles.orgId, orgId), eq(projectFiles.projectId, projectId)));
  const diary = await tx.select({ photos: projectDiary.photos }).from(projectDiary).where(and(eq(projectDiary.orgId, orgId), eq(projectDiary.projectId, projectId)));
  return [...files.map((f) => f.key), ...diary.flatMap((d) => d.photos.map((p) => p.key))];
}

export type ProjectFilter = "active" | "complete" | "all";

/** Projects with their client, manager and task counts, for the list. Active ones by start date. */
export async function listProjects(tx: Tx, orgId: string, filter: ProjectFilter = "active", today: string) {
  const taskCounts = tx
    .select({
      projectId: projectTasks.projectId,
      total: count().as("total"),
      done: sql<number>`count(*) filter (where ${projectTasks.status} = 'done')`.mapWith(Number).as("done"),
      waiting: sql<number>`count(*) filter (where ${projectTasks.status} = 'waiting')`.mapWith(Number).as("waiting"),
      late: sql<number>`count(*) filter (where ${projectTasks.status} <> 'done' and ${projectTasks.dueDate} < ${today})`.mapWith(Number).as("late"),
    })
    .from(projectTasks)
    .where(eq(projectTasks.orgId, orgId))
    .groupBy(projectTasks.projectId)
    .as("task_counts");
  return tx
    .select({
      id: projects.id,
      name: projects.name,
      status: projects.status,
      startDate: projects.startDate,
      endDate: projects.endDate,
      siteAddress: projects.siteAddress,
      clientName: clients.name,
      managerName: members.name,
      total: sql<number>`coalesce(${taskCounts.total}, 0)`.mapWith(Number),
      done: sql<number>`coalesce(${taskCounts.done}, 0)`.mapWith(Number),
      waiting: sql<number>`coalesce(${taskCounts.waiting}, 0)`.mapWith(Number),
      late: sql<number>`coalesce(${taskCounts.late}, 0)`.mapWith(Number),
    })
    .from(projects)
    .innerJoin(clients, and(eq(clients.orgId, projects.orgId), eq(clients.id, projects.clientId)))
    .leftJoin(members, and(eq(members.orgId, projects.orgId), eq(members.id, projects.managerMemberId)))
    .leftJoin(taskCounts, eq(taskCounts.projectId, projects.id))
    .where(
      and(
        eq(projects.orgId, orgId),
        filter === "active" ? inArray(projects.status, [...ACTIVE]) : filter === "complete" ? eq(projects.status, "complete") : undefined,
      ),
    )
    .orderBy(filter === "complete" ? desc(projects.completedAt) : sql`${projects.startDate} asc nulls last`, asc(projects.name))
    .limit(500);
}

/** One project with everything the project screen shows (not diary or files, which load per tab). */
export async function getProject(tx: Tx, orgId: string, projectId: string) {
  const [row] = await tx
    .select({ project: projects, clientName: clients.name, clientEmail: clients.email, managerName: members.name, quoteNumber: quotes.number, quoteTitle: quotes.title })
    .from(projects)
    .innerJoin(clients, and(eq(clients.orgId, projects.orgId), eq(clients.id, projects.clientId)))
    .leftJoin(members, and(eq(members.orgId, projects.orgId), eq(members.id, projects.managerMemberId)))
    .leftJoin(quotes, and(eq(quotes.orgId, projects.orgId), eq(quotes.id, projects.quoteId)))
    .where(and(eq(projects.orgId, orgId), eq(projects.id, projectId)));
  if (!row) return undefined;
  const phases = await tx
    .select({ id: projectPhases.id, name: projectPhases.name, position: projectPhases.position })
    .from(projectPhases)
    .where(and(eq(projectPhases.orgId, orgId), eq(projectPhases.projectId, projectId)))
    .orderBy(asc(projectPhases.position));
  const tasks = await tx
    .select({
      id: projectTasks.id,
      phaseId: projectTasks.phaseId,
      title: projectTasks.title,
      notes: projectTasks.notes,
      status: projectTasks.status,
      position: projectTasks.position,
      assigneeMemberId: projectTasks.assigneeMemberId,
      assigneeName: members.name,
      trade: projectTasks.trade,
      startDate: projectTasks.startDate,
      dueDate: projectTasks.dueDate,
      completedAt: projectTasks.completedAt,
    })
    .from(projectTasks)
    .leftJoin(members, and(eq(members.orgId, projectTasks.orgId), eq(members.id, projectTasks.assigneeMemberId)))
    .where(and(eq(projectTasks.orgId, orgId), eq(projectTasks.projectId, projectId)))
    .orderBy(asc(projectTasks.position), asc(projectTasks.createdAt));
  return { ...row, phases, tasks };
}

/** Money on a quote-based project: what was agreed, approved changes, invoiced and paid. */
export async function projectMoney(tx: Tx, orgId: string, quoteId: string) {
  const [agreed] = await tx
    .select({ total: quoteVersions.totalPence })
    .from(quoteDecisions)
    .innerJoin(quoteVersions, and(eq(quoteVersions.orgId, quoteDecisions.orgId), eq(quoteVersions.id, quoteDecisions.versionId)))
    .where(and(eq(quoteDecisions.orgId, orgId), eq(quoteDecisions.quoteId, quoteId), eq(quoteDecisions.decision, "accepted")));
  const [v] = await tx
    .select({
      approved: sql<number>`coalesce(sum(${variations.totalPence}) filter (where ${variations.status} = 'approved'), 0)`.mapWith(Number),
      awaiting: sql<number>`count(*) filter (where ${variations.status} = 'sent')`.mapWith(Number),
    })
    .from(variations)
    .where(and(eq(variations.orgId, orgId), eq(variations.quoteId, quoteId)));
  const [i] = await tx
    .select({
      invoiced: sql<number>`coalesce(sum(${invoices.totalPence}), 0)`.mapWith(Number),
      paid: sql<number>`coalesce(sum(${invoices.totalPence}) filter (where ${invoices.status} = 'paid'), 0)`.mapWith(Number),
    })
    .from(invoices)
    .where(and(eq(invoices.orgId, orgId), eq(invoices.quoteId, quoteId), ne(invoices.status, "void")));
  const contract = (agreed?.total ?? 0) + (v?.approved ?? 0);
  return { agreed: agreed?.total ?? 0, approvedVariations: v?.approved ?? 0, awaitingVariations: v?.awaiting ?? 0, contract, invoiced: i?.invoiced ?? 0, paid: i?.paid ?? 0 };
}

// ── Stages ───────────────────────────────────────────────────────────────────

async function assertProject(tx: Tx, orgId: string, projectId: string) {
  const [p] = await tx.select({ id: projects.id }).from(projects).where(and(eq(projects.orgId, orgId), eq(projects.id, projectId)));
  if (!p) throw new ProjectError("not_found");
}

export async function addPhase(tx: Tx, orgId: string, projectId: string, name: string): Promise<string> {
  await assertProject(tx, orgId, projectId);
  const [{ n, next }] = await tx
    .select({ n: count(), next: sql<number>`coalesce(max(${projectPhases.position}), -1) + 1`.mapWith(Number) })
    .from(projectPhases)
    .where(and(eq(projectPhases.orgId, orgId), eq(projectPhases.projectId, projectId)));
  if (n >= MAX_PHASES_PER_PROJECT) throw new ProjectError("too_many");
  const [row] = await tx.insert(projectPhases).values({ orgId, projectId, name, position: next }).returning({ id: projectPhases.id });
  return row.id;
}

export async function renamePhase(tx: Tx, orgId: string, projectId: string, phaseId: string, name: string) {
  const rows = await tx
    .update(projectPhases)
    .set({ name })
    .where(and(eq(projectPhases.orgId, orgId), eq(projectPhases.projectId, projectId), eq(projectPhases.id, phaseId)))
    .returning({ id: projectPhases.id });
  if (rows.length === 0) throw new ProjectError("unknown_phase");
}

/** Swap a stage with its neighbour above (-1) or below (+1). */
export async function movePhase(tx: Tx, orgId: string, projectId: string, phaseId: string, dir: -1 | 1) {
  const list = await tx
    .select({ id: projectPhases.id })
    .from(projectPhases)
    .where(and(eq(projectPhases.orgId, orgId), eq(projectPhases.projectId, projectId)))
    .orderBy(asc(projectPhases.position));
  const i = list.findIndex((p) => p.id === phaseId);
  if (i < 0) throw new ProjectError("unknown_phase");
  const j = i + dir;
  if (j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  for (const [position, p] of list.entries()) {
    await tx.update(projectPhases).set({ position }).where(and(eq(projectPhases.orgId, orgId), eq(projectPhases.id, p.id)));
  }
}

/** Delete a stage. Its tasks stay, without a stage. */
export async function deletePhase(tx: Tx, orgId: string, projectId: string, phaseId: string) {
  await tx
    .update(projectTasks)
    .set({ phaseId: null })
    .where(and(eq(projectTasks.orgId, orgId), eq(projectTasks.projectId, projectId), eq(projectTasks.phaseId, phaseId)));
  const rows = await tx
    .delete(projectPhases)
    .where(and(eq(projectPhases.orgId, orgId), eq(projectPhases.projectId, projectId), eq(projectPhases.id, phaseId)))
    .returning({ id: projectPhases.id });
  if (rows.length === 0) throw new ProjectError("unknown_phase");
}

// ── Tasks ────────────────────────────────────────────────────────────────────

async function assertPhase(tx: Tx, orgId: string, projectId: string, phaseId: string | undefined) {
  if (!phaseId) return;
  const [p] = await tx
    .select({ id: projectPhases.id })
    .from(projectPhases)
    .where(and(eq(projectPhases.orgId, orgId), eq(projectPhases.projectId, projectId), eq(projectPhases.id, phaseId)));
  if (!p) throw new ProjectError("unknown_phase");
}

const doneAt = (status: TaskStatus) => (status === "done" ? sql`coalesce(${projectTasks.completedAt}, now())` : null);

/** Add a task at the end of its column. */
export async function addTask(tx: Tx, orgId: string, input: TaskInput, memberId: string): Promise<string> {
  await assertProject(tx, orgId, input.projectId);
  await assertPhase(tx, orgId, input.projectId, input.phaseId);
  await assertMember(tx, orgId, input.assigneeMemberId);
  const [{ n, next }] = await tx
    .select({ n: count(), next: sql<number>`coalesce(max(${projectTasks.position}), -1) + 1`.mapWith(Number) })
    .from(projectTasks)
    .where(and(eq(projectTasks.orgId, orgId), eq(projectTasks.projectId, input.projectId)));
  if (n >= MAX_TASKS_PER_PROJECT) throw new ProjectError("too_many");
  const [row] = await tx
    .insert(projectTasks)
    .values({
      orgId,
      projectId: input.projectId,
      phaseId: input.phaseId ?? null,
      title: input.title,
      notes: input.notes || null,
      status: input.status,
      position: next,
      assigneeMemberId: input.assigneeMemberId ?? null,
      trade: input.trade ?? null,
      startDate: input.startDate ?? null,
      dueDate: input.dueDate ?? null,
      completedAt: input.status === "done" ? new Date() : null,
      createdByMemberId: memberId,
    })
    .returning({ id: projectTasks.id });
  return row.id;
}

export async function updateTask(tx: Tx, orgId: string, taskId: string, input: TaskInput) {
  await assertPhase(tx, orgId, input.projectId, input.phaseId);
  await assertMember(tx, orgId, input.assigneeMemberId);
  const rows = await tx
    .update(projectTasks)
    .set({
      phaseId: input.phaseId ?? null,
      title: input.title,
      notes: input.notes || null,
      status: input.status,
      assigneeMemberId: input.assigneeMemberId ?? null,
      trade: input.trade ?? null,
      startDate: input.startDate ?? null,
      dueDate: input.dueDate ?? null,
      completedAt: doneAt(input.status),
    })
    .where(and(eq(projectTasks.orgId, orgId), eq(projectTasks.projectId, input.projectId), eq(projectTasks.id, taskId)))
    .returning({ id: projectTasks.id });
  if (rows.length === 0) throw new ProjectError("not_found");
}

export async function setTaskStatus(tx: Tx, orgId: string, projectId: string, taskId: string, status: TaskStatus) {
  const rows = await tx
    .update(projectTasks)
    .set({ status, completedAt: doneAt(status) })
    .where(and(eq(projectTasks.orgId, orgId), eq(projectTasks.projectId, projectId), eq(projectTasks.id, taskId)))
    .returning({ id: projectTasks.id });
  if (rows.length === 0) throw new ProjectError("not_found");
}

/**
 * A drag on the board: put the task in `status`, then number that column in `order`. Ids in `order` that
 * aren't this project's tasks in that column are ignored, so a stale screen can't misplace anything.
 */
export async function moveTask(tx: Tx, orgId: string, input: { projectId: string; taskId: string; status: TaskStatus; order: string[] }) {
  await setTaskStatus(tx, orgId, input.projectId, input.taskId, input.status);
  const column = await tx
    .select({ id: projectTasks.id })
    .from(projectTasks)
    .where(and(eq(projectTasks.orgId, orgId), eq(projectTasks.projectId, input.projectId), eq(projectTasks.status, input.status)));
  const inColumn = new Set(column.map((c) => c.id));
  const ordered = [...input.order.filter((id) => inColumn.has(id)), ...column.map((c) => c.id).filter((id) => !input.order.includes(id))];
  const unique = [...new Set(ordered)];
  if (unique.length === 0) return;
  // One statement: position = index in the new order. The ids come from the query above (real uuids from
  // the database), never straight from the request, so building the array literal here is safe.
  await tx.execute(sql`
    update project_tasks t set position = o.position
    from (select * from unnest(${sql.raw(`array[${unique.map((id) => `'${id}'`).join(",")}]::uuid[]`)}) with ordinality as x(id, position)) o
    where t.org_id = ${orgId} and t.project_id = ${input.projectId} and t.id = o.id`);
}

export async function deleteTask(tx: Tx, orgId: string, projectId: string, taskId: string) {
  const rows = await tx
    .delete(projectTasks)
    .where(and(eq(projectTasks.orgId, orgId), eq(projectTasks.projectId, projectId), eq(projectTasks.id, taskId)))
    .returning({ id: projectTasks.id });
  if (rows.length === 0) throw new ProjectError("not_found");
}

// ── Site diary ───────────────────────────────────────────────────────────────

export async function listDiary(tx: Tx, orgId: string, projectId: string) {
  return tx
    .select({
      id: projectDiary.id,
      entryDate: projectDiary.entryDate,
      body: projectDiary.body,
      weather: projectDiary.weather,
      photos: projectDiary.photos,
      shareWithClient: projectDiary.shareWithClient,
      authorName: members.name,
      createdAt: projectDiary.createdAt,
    })
    .from(projectDiary)
    .leftJoin(members, and(eq(members.orgId, projectDiary.orgId), eq(members.id, projectDiary.authorMemberId)))
    .where(and(eq(projectDiary.orgId, orgId), eq(projectDiary.projectId, projectId)))
    .orderBy(desc(projectDiary.entryDate), desc(projectDiary.createdAt))
    .limit(500);
}

export async function addDiaryEntry(tx: Tx, orgId: string, input: DiaryInput, memberId: string): Promise<string> {
  await assertProject(tx, orgId, input.projectId);
  const [row] = await tx
    .insert(projectDiary)
    .values({ orgId, projectId: input.projectId, entryDate: input.entryDate, body: input.body, weather: input.weather ?? null, shareWithClient: input.shareWithClient, authorMemberId: memberId })
    .returning({ id: projectDiary.id });
  return row.id;
}

export async function setDiaryShared(tx: Tx, orgId: string, projectId: string, entryId: string, shared: boolean) {
  const rows = await tx
    .update(projectDiary)
    .set({ shareWithClient: shared })
    .where(and(eq(projectDiary.orgId, orgId), eq(projectDiary.projectId, projectId), eq(projectDiary.id, entryId)))
    .returning({ id: projectDiary.id });
  if (rows.length === 0) throw new ProjectError("not_found");
}

/** Delete an entry. Returns its photo keys, to delete from storage. */
export async function deleteDiaryEntry(tx: Tx, orgId: string, projectId: string, entryId: string): Promise<string[]> {
  const rows = await tx
    .delete(projectDiary)
    .where(and(eq(projectDiary.orgId, orgId), eq(projectDiary.projectId, projectId), eq(projectDiary.id, entryId)))
    .returning({ photos: projectDiary.photos });
  if (rows.length === 0) throw new ProjectError("not_found");
  return rows[0].photos.map((p) => p.key);
}

export async function addDiaryPhoto(tx: Tx, orgId: string, projectId: string, entryId: string, key: string) {
  const rows = await tx
    .update(projectDiary)
    .set({ photos: sql`${projectDiary.photos} || ${JSON.stringify([{ key }])}::jsonb` })
    .where(and(eq(projectDiary.orgId, orgId), eq(projectDiary.projectId, projectId), eq(projectDiary.id, entryId), sql`jsonb_array_length(${projectDiary.photos}) < ${MAX_DIARY_PHOTOS}`))
    .returning({ id: projectDiary.id });
  if (rows.length === 0) {
    const [exists] = await tx.select({ id: projectDiary.id }).from(projectDiary).where(and(eq(projectDiary.orgId, orgId), eq(projectDiary.projectId, projectId), eq(projectDiary.id, entryId)));
    throw new ProjectError(exists ? "too_many_photos" : "not_found");
  }
}

// ── Files ────────────────────────────────────────────────────────────────────

export async function listFiles(tx: Tx, orgId: string, projectId: string) {
  return tx
    .select({
      id: projectFiles.id,
      name: projectFiles.name,
      storageKey: projectFiles.storageKey,
      contentType: projectFiles.contentType,
      sizeBytes: projectFiles.sizeBytes,
      shareWithClient: projectFiles.shareWithClient,
      uploadedByName: members.name,
      createdAt: projectFiles.createdAt,
    })
    .from(projectFiles)
    .leftJoin(members, and(eq(members.orgId, projectFiles.orgId), eq(members.id, projectFiles.uploadedByMemberId)))
    .where(and(eq(projectFiles.orgId, orgId), eq(projectFiles.projectId, projectId)))
    .orderBy(desc(projectFiles.createdAt));
}

export async function addFile(tx: Tx, orgId: string, input: { projectId: string; name: string; storageKey: string; contentType: string; sizeBytes: number; memberId: string }) {
  await assertProject(tx, orgId, input.projectId);
  const [row] = await tx
    .insert(projectFiles)
    .values({ orgId, projectId: input.projectId, name: input.name, storageKey: input.storageKey, contentType: input.contentType, sizeBytes: input.sizeBytes, uploadedByMemberId: input.memberId })
    .returning({ id: projectFiles.id });
  return row.id;
}

export async function setFileShared(tx: Tx, orgId: string, projectId: string, fileId: string, shared: boolean) {
  const rows = await tx
    .update(projectFiles)
    .set({ shareWithClient: shared })
    .where(and(eq(projectFiles.orgId, orgId), eq(projectFiles.projectId, projectId), eq(projectFiles.id, fileId)))
    .returning({ id: projectFiles.id });
  if (rows.length === 0) throw new ProjectError("not_found");
}

/** Delete a file record. Returns its storage key. */
export async function deleteFile(tx: Tx, orgId: string, projectId: string, fileId: string): Promise<string> {
  const rows = await tx
    .delete(projectFiles)
    .where(and(eq(projectFiles.orgId, orgId), eq(projectFiles.projectId, projectId), eq(projectFiles.id, fileId)))
    .returning({ key: projectFiles.storageKey });
  if (rows.length === 0) throw new ProjectError("not_found");
  return rows[0].key;
}

// ── Client portal ────────────────────────────────────────────────────────────

/** The client's projects that share progress with them. */
export async function portalProjects(tx: Tx, orgId: string, clientId: string) {
  return tx
    .select({
      id: projects.id,
      name: projects.name,
      status: projects.status,
      // Spelled out: inside a sub-select, interpolated columns lose their table name and would bind to t.
      total: sql<number>`(select count(*) from project_tasks t where t.org_id = "projects"."org_id" and t.project_id = "projects"."id")`.mapWith(Number),
      done: sql<number>`(select count(*) from project_tasks t where t.org_id = "projects"."org_id" and t.project_id = "projects"."id" and t.status = 'done')`.mapWith(Number),
    })
    .from(projects)
    .where(and(eq(projects.orgId, orgId), eq(projects.clientId, clientId), eq(projects.shareProgress, true)))
    .orderBy(desc(projects.createdAt));
}

/**
 * What a client sees of a project: stage-by-stage progress (task counts, never the task list itself, which
 * is the team's working notes), key dates, and only the diary entries and files marked as shared.
 */
export async function portalProject(tx: Tx, orgId: string, clientId: string, projectId: string) {
  const [p] = await tx
    .select({ id: projects.id, name: projects.name, status: projects.status, startDate: projects.startDate, endDate: projects.endDate, siteAddress: projects.siteAddress })
    .from(projects)
    .where(and(eq(projects.orgId, orgId), eq(projects.clientId, clientId), eq(projects.id, projectId), eq(projects.shareProgress, true)));
  if (!p) return undefined;
  const phases = await tx
    .select({
      id: projectPhases.id,
      name: projectPhases.name,
      total: sql<number>`count(${projectTasks.id})`.mapWith(Number),
      done: sql<number>`count(${projectTasks.id}) filter (where ${projectTasks.status} = 'done')`.mapWith(Number),
      started: sql<number>`count(${projectTasks.id}) filter (where ${projectTasks.status} <> 'todo')`.mapWith(Number),
    })
    .from(projectPhases)
    .leftJoin(projectTasks, and(eq(projectTasks.orgId, projectPhases.orgId), eq(projectTasks.phaseId, projectPhases.id)))
    .where(and(eq(projectPhases.orgId, orgId), eq(projectPhases.projectId, projectId)))
    .groupBy(projectPhases.id)
    .orderBy(asc(projectPhases.position));
  const [loose] = await tx
    .select({
      total: count(),
      done: sql<number>`count(*) filter (where ${projectTasks.status} = 'done')`.mapWith(Number),
      started: sql<number>`count(*) filter (where ${projectTasks.status} <> 'todo')`.mapWith(Number),
    })
    .from(projectTasks)
    .where(and(eq(projectTasks.orgId, orgId), eq(projectTasks.projectId, projectId), isNull(projectTasks.phaseId)));
  const diary = await tx
    .select({ id: projectDiary.id, entryDate: projectDiary.entryDate, body: projectDiary.body, photos: projectDiary.photos })
    .from(projectDiary)
    .where(and(eq(projectDiary.orgId, orgId), eq(projectDiary.projectId, projectId), eq(projectDiary.shareWithClient, true)))
    .orderBy(desc(projectDiary.entryDate), desc(projectDiary.createdAt))
    .limit(100);
  const files = await tx
    .select({ id: projectFiles.id, name: projectFiles.name, storageKey: projectFiles.storageKey, contentType: projectFiles.contentType, sizeBytes: projectFiles.sizeBytes })
    .from(projectFiles)
    .where(and(eq(projectFiles.orgId, orgId), eq(projectFiles.projectId, projectId), eq(projectFiles.shareWithClient, true)))
    .orderBy(desc(projectFiles.createdAt));
  return { ...p, phases, loose: loose ?? { total: 0, done: 0, started: 0 }, diary, files };
}
