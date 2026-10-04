"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { can } from "@/core/roles";
import { certificateInput, id, workerInput } from "@/core/schemas";
import { TeamError, addCertificate, createWorker, deleteCertificate, linkWorker, setWorkerArchived, updateCertificate, updateWorker, type TeamErrorReason } from "@/db/team";
import { getSession, withSession, type Session } from "@/auth/session";

export type TeamActionResult = { ok: true } | { ok: false; message: string };

const NOT_ALLOWED = "Only Admins and the office can change the team.";
const MESSAGES: Record<TeamErrorReason, string> = {
  not_found: "This person was removed or changed somewhere else. Reload to see the latest.",
  member_taken: "That login is already linked to someone else on the team.",
  unknown_member: "That login no longer exists.",
};

async function editor(): Promise<Session | null> {
  const session = await getSession();
  return can(session.role, "team.edit") ? session : null;
}

async function change(workerId: unknown, fn: (s: Session, workerId: string) => Promise<unknown>): Promise<TeamActionResult> {
  const session = await editor();
  if (!session) return { ok: false, message: NOT_ALLOWED };
  const w = id.safeParse(workerId);
  if (!w.success) return { ok: false, message: MESSAGES.not_found };
  try {
    await fn(session, w.data);
  } catch (error) {
    if (error instanceof TeamError) return { ok: false, message: MESSAGES[error.reason] };
    throw error;
  }
  revalidatePath("/app/team");
  revalidatePath(`/app/team/${w.data}`);
  return { ok: true };
}

const firstIssue = (e: { issues: { path: PropertyKey[]; message: string }[] }) => {
  const i = e.issues[0];
  const field = String(i?.path[0] ?? "");
  const labels: Record<string, string> = { name: "Enter a name.", phone: "Check the phone number.", emergencyPhone: "Check the emergency phone number.", email: "Check the email address.", dayRatePence: "Check the day rate." };
  return labels[field] ?? "Check what you've entered.";
};

export async function createWorkerAction(input: unknown): Promise<TeamActionResult> {
  const session = await editor();
  if (!session) return { ok: false, message: NOT_ALLOWED };
  const parsed = workerInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) };
  const data = can(session.role, "costs.view") ? parsed.data : { ...parsed.data, dayRatePence: undefined };
  const workerId = await withSession(session, (tx) => createWorker(tx, session.orgId, data));
  revalidatePath("/app/team");
  redirect(`/app/team/${workerId}`);
}

export async function updateWorkerAction(workerId: string, input: unknown): Promise<TeamActionResult> {
  const parsed = workerInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) };
  return change(workerId, (s, w) => withSession(s, (tx) => updateWorker(tx, s.orgId, w, parsed.data, can(s.role, "costs.view"))));
}

export async function archiveWorkerAction(workerId: string, archived: boolean): Promise<TeamActionResult> {
  return change(workerId, (s, w) => withSession(s, (tx) => setWorkerArchived(tx, s.orgId, w, archived === true)));
}

export async function linkWorkerAction(workerId: string, memberId: string | null): Promise<TeamActionResult> {
  if (memberId !== null && !id.safeParse(memberId).success) return { ok: false, message: MESSAGES.unknown_member };
  return change(workerId, (s, w) => withSession(s, (tx) => linkWorker(tx, s.orgId, w, memberId)));
}

export async function addCertificateAction(workerId: string, input: unknown): Promise<TeamActionResult> {
  const parsed = certificateInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Give the certificate a name, and check the date." };
  return change(workerId, (s, w) => withSession(s, (tx) => addCertificate(tx, s.orgId, w, parsed.data)));
}

export async function updateCertificateAction(workerId: string, certificateId: string, input: unknown): Promise<TeamActionResult> {
  const parsed = certificateInput.safeParse(input);
  if (!parsed.success || !id.safeParse(certificateId).success) return { ok: false, message: "Give the certificate a name, and check the date." };
  return change(workerId, (s, w) => withSession(s, (tx) => updateCertificate(tx, s.orgId, w, certificateId, parsed.data)));
}

export async function deleteCertificateAction(workerId: string, certificateId: string): Promise<TeamActionResult> {
  if (!id.safeParse(certificateId).success) return { ok: false, message: MESSAGES.not_found };
  return change(workerId, (s, w) => withSession(s, (tx) => deleteCertificate(tx, s.orgId, w, certificateId)));
}
