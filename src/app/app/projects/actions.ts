"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { MAX_FILE_BYTES, MAX_PHOTO_BYTES, orgFileKey, sniffDocument, sniffImage } from "@/core/files";
import { MAX_DIARY_PHOTOS, TASK_STATUSES, type TaskStatus } from "@/core/projects";
import { can } from "@/core/roles";
import { diaryInput, id, moveTaskInput, phaseInput, projectFromQuoteInput, projectInput, singleLine, taskInput } from "@/core/schemas";
import { TEXT } from "@/core/limits";
import {
  ProjectError,
  addDiaryEntry,
  addDiaryPhoto,
  addFile,
  addPhase,
  addTask,
  createProject,
  createProjectFromQuote,
  deleteDiaryEntry,
  deleteFile,
  deletePhase,
  deleteProject,
  deleteTask,
  movePhase,
  moveTask,
  renamePhase,
  setDiaryShared,
  setFileShared,
  setTaskStatus,
  updateProject,
  updateTask,
  type ProjectErrorReason,
} from "@/db/projects";
import { hasFeature, planBlock } from "@/server/plan";
import { getSession, withSession, type Session } from "@/auth/session";
import { deleteObject, privateUrl, putObject, randomName, storageConfigured } from "@/server/storage";

export type ProjectActionResult = { ok: true; id?: string } | { ok: false; message: string };

const NOT_ALLOWED = "Your role can't change projects.";
const MESSAGES: Record<ProjectErrorReason, string> = {
  not_found: "This was removed or changed somewhere else. Reload to see the latest.",
  not_accepted: "Projects can be started from accepted quotes only.",
  exists: "This quote already has a project.",
  unknown_client: "Choose one of your clients.",
  unknown_member: "Choose someone from your team.",
  unknown_worker: "Choose someone on your team (archived people can't be given tasks).",
  unknown_phase: "That stage isn't on this project any more. Reload to see the latest.",
  too_many: "This project has reached its limit.",
  too_many_photos: `A diary entry can have up to ${MAX_DIARY_PHOTOS} photos.`,
};

async function editor(): Promise<Session | null> {
  const session = await getSession();
  return can(session.role, "projects.edit") && (await hasFeature("projects")) ? session : null;
}

/** Why editor() said no: the plan, or the role. */
const refused = async () => (await planBlock("projects")) ?? NOT_ALLOWED;

/** Run a project change: permission, then the change, then refresh the project's pages. */
async function change(projectId: unknown, fn: (session: Session, projectId: string) => Promise<string | void>): Promise<ProjectActionResult> {
  const session = await editor();
  if (!session) return { ok: false, message: await refused() };
  const parsed = id.safeParse(projectId);
  if (!parsed.success) return { ok: false, message: MESSAGES.not_found };
  let result: string | void;
  try {
    result = await fn(session, parsed.data);
  } catch (error) {
    if (error instanceof ProjectError) return { ok: false, message: MESSAGES[error.reason] };
    throw error;
  }
  revalidatePath(`/app/projects/${parsed.data}`);
  return { ok: true, id: result || undefined };
}

const invalid = (issues: z.ZodError) => ({ ok: false as const, message: issues.issues[0]?.message && issues.issues[0].message !== "Invalid input" ? issues.issues[0].message : "Check what you've entered." });

// ── Projects ─────────────────────────────────────────────────────────────────

export async function startProjectFromQuote(input: unknown): Promise<ProjectActionResult> {
  const session = await editor();
  if (!session) return { ok: false, message: await refused() };
  const parsed = projectFromQuoteInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  let projectId: string;
  try {
    projectId = await withSession(session, (tx) => createProjectFromQuote(tx, session.orgId, parsed.data, session.memberId));
  } catch (error) {
    if (error instanceof ProjectError && error.reason === "exists" && error.projectId) redirect(`/app/projects/${error.projectId}`);
    if (error instanceof ProjectError) return { ok: false, message: MESSAGES[error.reason] };
    throw error;
  }
  revalidatePath(`/app/quotes/${parsed.data.quoteId}`);
  revalidatePath("/app/projects");
  redirect(`/app/projects/${projectId}`);
}

export async function createProjectAction(input: unknown): Promise<ProjectActionResult> {
  const session = await editor();
  if (!session) return { ok: false, message: await refused() };
  const parsed = projectInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  let projectId: string;
  try {
    projectId = await withSession(session, (tx) => createProject(tx, session.orgId, parsed.data, session.memberId));
  } catch (error) {
    if (error instanceof ProjectError) return { ok: false, message: MESSAGES[error.reason] };
    throw error;
  }
  revalidatePath("/app/projects");
  redirect(`/app/projects/${projectId}`);
}

export async function updateProjectAction(projectId: string, input: unknown): Promise<ProjectActionResult> {
  const parsed = projectInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const r = await change(projectId, (s, pid) => withSession(s, (tx) => updateProject(tx, s.orgId, pid, parsed.data)));
  revalidatePath("/app/projects");
  return r;
}

export async function deleteProjectAction(projectId: string): Promise<ProjectActionResult> {
  // Deleting a project deletes its costs, receipts, purchase orders and timesheets too: Admins and the office only.
  if (!can((await getSession()).role, "costs.edit")) return { ok: false, message: "Only Admins and the office can delete a project. Mark it complete instead." };
  let keys: string[] = [];
  const r = await change(projectId, async (s, pid) => {
    keys = await withSession(s, (tx) => deleteProject(tx, s.orgId, pid));
  });
  if (!r.ok) return r;
  for (const key of keys) await deleteObject(key);
  revalidatePath("/app/projects");
  redirect("/app/projects");
}

// ── Stages ───────────────────────────────────────────────────────────────────

export async function addPhaseAction(input: unknown): Promise<ProjectActionResult> {
  const parsed = phaseInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return change(parsed.data.projectId, (s, pid) => withSession(s, (tx) => addPhase(tx, s.orgId, pid, parsed.data.name)));
}

export async function renamePhaseAction(projectId: string, phaseId: string, name: string): Promise<ProjectActionResult> {
  const n = singleLine(TEXT.name).safeParse(name);
  if (!n.success || !id.safeParse(phaseId).success) return { ok: false, message: "Give the stage a name." };
  return change(projectId, (s, pid) => withSession(s, (tx) => renamePhase(tx, s.orgId, pid, phaseId, n.data)));
}

export async function movePhaseAction(projectId: string, phaseId: string, dir: -1 | 1): Promise<ProjectActionResult> {
  if (!id.safeParse(phaseId).success || (dir !== -1 && dir !== 1)) return { ok: false, message: MESSAGES.unknown_phase };
  return change(projectId, (s, pid) => withSession(s, (tx) => movePhase(tx, s.orgId, pid, phaseId, dir)));
}

export async function deletePhaseAction(projectId: string, phaseId: string): Promise<ProjectActionResult> {
  if (!id.safeParse(phaseId).success) return { ok: false, message: MESSAGES.unknown_phase };
  return change(projectId, (s, pid) => withSession(s, (tx) => deletePhase(tx, s.orgId, pid, phaseId)));
}

// ── Tasks ────────────────────────────────────────────────────────────────────

/** Add a task (from the dialog or a quick-add box). */
export async function addTaskAction(input: unknown): Promise<ProjectActionResult> {
  const parsed = taskInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return change(parsed.data.projectId, (s) => withSession(s, (tx) => addTask(tx, s.orgId, parsed.data, s.memberId)));
}

export async function updateTaskAction(taskId: string, input: unknown): Promise<ProjectActionResult> {
  const parsed = taskInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  if (!id.safeParse(taskId).success) return { ok: false, message: MESSAGES.not_found };
  return change(parsed.data.projectId, (s) => withSession(s, (tx) => updateTask(tx, s.orgId, taskId, parsed.data, s.memberId)));
}

export async function setTaskStatusAction(projectId: string, taskId: string, status: TaskStatus): Promise<ProjectActionResult> {
  if (!id.safeParse(taskId).success || !(TASK_STATUSES as readonly string[]).includes(status)) return { ok: false, message: MESSAGES.not_found };
  return change(projectId, (s, pid) => withSession(s, (tx) => setTaskStatus(tx, s.orgId, pid, taskId, status)));
}

export async function moveTaskAction(input: unknown): Promise<ProjectActionResult> {
  const parsed = moveTaskInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return change(parsed.data.projectId, (s) => withSession(s, (tx) => moveTask(tx, s.orgId, parsed.data)));
}

export async function deleteTaskAction(projectId: string, taskId: string): Promise<ProjectActionResult> {
  if (!id.safeParse(taskId).success) return { ok: false, message: MESSAGES.not_found };
  return change(projectId, (s, pid) => withSession(s, (tx) => deleteTask(tx, s.orgId, pid, taskId)));
}

// ── Site diary ───────────────────────────────────────────────────────────────

export async function addDiaryEntryAction(input: unknown): Promise<ProjectActionResult> {
  const parsed = diaryInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return change(parsed.data.projectId, (s) => withSession(s, (tx) => addDiaryEntry(tx, s.orgId, parsed.data, s.memberId)));
}

export async function setDiarySharedAction(projectId: string, entryId: string, shared: boolean): Promise<ProjectActionResult> {
  if (!id.safeParse(entryId).success) return { ok: false, message: MESSAGES.not_found };
  return change(projectId, (s, pid) => withSession(s, (tx) => setDiaryShared(tx, s.orgId, pid, entryId, shared === true)));
}

export async function deleteDiaryEntryAction(projectId: string, entryId: string): Promise<ProjectActionResult> {
  if (!id.safeParse(entryId).success) return { ok: false, message: MESSAGES.not_found };
  let keys: string[] = [];
  const r = await change(projectId, async (s, pid) => {
    keys = await withSession(s, (tx) => deleteDiaryEntry(tx, s.orgId, pid, entryId));
  });
  if (r.ok) for (const key of keys) await deleteObject(key);
  return r;
}

/** Add a photo (already shrunk in the browser) to a diary entry. */
export async function uploadDiaryPhoto(form: FormData): Promise<ProjectActionResult> {
  if (!storageConfigured()) return { ok: false, message: "File storage isn't set up yet, so photos can't be added." };
  const projectId = form.get("projectId");
  const entryId = form.get("entryId");
  const file = form.get("photo");
  if (typeof entryId !== "string" || !id.safeParse(entryId).success) return { ok: false, message: MESSAGES.not_found };
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Choose a photo." };
  if (file.size > MAX_PHOTO_BYTES) return { ok: false, message: "That photo is too large. Try a smaller one." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffImage(bytes);
  if (!type) return { ok: false, message: "Use a JPEG, PNG or WebP photo." };
  let key = "";
  const r = await change(projectId, async (s, pid) => {
    key = orgFileKey(s.orgId, "photos", randomName(), type.ext);
    const stored = await putObject(key, bytes, type.mime);
    if (!stored.ok) throw new StoreError(stored.message);
    try {
      await withSession(s, (tx) => addDiaryPhoto(tx, s.orgId, pid, entryId, key));
    } catch (error) {
      await deleteObject(key);
      throw error;
    }
  }).catch((error: unknown) => {
    if (error instanceof StoreError) return { ok: false as const, message: error.message };
    throw error;
  });
  return r;
}

// ── Files ────────────────────────────────────────────────────────────────────

class StoreError extends Error {}

export type FileUploadResult = { ok: true; id: string; url: string } | { ok: false; message: string };

/** Upload a document (PDF or image) to a project. Type from the bytes; the name is only a label. */
export async function uploadProjectFile(form: FormData): Promise<FileUploadResult> {
  if (!storageConfigured()) return { ok: false, message: "File storage isn't set up yet, so files can't be added." };
  const projectId = form.get("projectId");
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Choose a file." };
  if (file.size > MAX_FILE_BYTES) return { ok: false, message: "That file is over 4 MB. Compress it (or split it) and try again." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffDocument(bytes);
  if (!type) return { ok: false, message: "Upload a PDF, or a JPEG, PNG or WebP image." };
  const name = singleLine(TEXT.name).safeParse(file.name.replace(/[\u0000-\u001F\u007F]/g, "").slice(0, TEXT.name));
  let key = "";
  const r = await change(projectId, async (s, pid) => {
    key = orgFileKey(s.orgId, "files", randomName(), type.ext);
    const stored = await putObject(key, bytes, type.mime);
    if (!stored.ok) throw new StoreError(stored.message);
    try {
      return await withSession(s, (tx) => addFile(tx, s.orgId, { projectId: pid, name: name.success ? name.data : `Document.${type.ext}`, storageKey: key, contentType: type.mime, sizeBytes: bytes.length, memberId: s.memberId }));
    } catch (error) {
      await deleteObject(key);
      throw error;
    }
  }).catch((error: unknown) => {
    if (error instanceof StoreError) return { ok: false as const, message: error.message };
    throw error;
  });
  return r.ok ? { ok: true, id: r.id!, url: privateUrl(key) } : r;
}

export async function setFileSharedAction(projectId: string, fileId: string, shared: boolean): Promise<ProjectActionResult> {
  if (!id.safeParse(fileId).success) return { ok: false, message: MESSAGES.not_found };
  return change(projectId, (s, pid) => withSession(s, (tx) => setFileShared(tx, s.orgId, pid, fileId, shared === true)));
}

export async function deleteFileAction(projectId: string, fileId: string): Promise<ProjectActionResult> {
  if (!id.safeParse(fileId).success) return { ok: false, message: MESSAGES.not_found };
  let key = "";
  const r = await change(projectId, async (s, pid) => {
    key = await withSession(s, (tx) => deleteFile(tx, s.orgId, pid, fileId));
  });
  if (r.ok && key) await deleteObject(key);
  return r;
}
