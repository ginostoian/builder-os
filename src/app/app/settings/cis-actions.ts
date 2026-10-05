"use server";

import { revalidatePath } from "next/cache";
import { can } from "@/core/roles";
import { cisSettingsInput, id, workerCisInput } from "@/core/schemas";
import { saveCisSettings, saveWorkerCis } from "@/db/cis";
import { getSession, withSession } from "@/auth/session";

export type CisActionResult = { ok: true } | { ok: false; message: string };

/** Turn CIS on or off and save the company's references. Admin only. */
export async function saveCisSettingsAction(input: unknown): Promise<CisActionResult> {
  const session = await getSession();
  if (!can(session.role, "settings.manage")) return { ok: false, message: "Only an Admin can change CIS settings." };
  const parsed = cisSettingsInput.safeParse(input);
  if (!parsed.success) {
    const field = String(parsed.error.issues[0]?.path[0] ?? "");
    const labels: Record<string, string> = {
      contractorUtr: "Your UTR is 10 digits.",
      employerRef: "Check the employer reference, e.g. 123/AB45678.",
      accountsOfficeRef: "Check the Accounts Office reference, e.g. 123PA00012345.",
    };
    return { ok: false, message: labels[field] ?? "Check what you've entered." };
  }
  const d = parsed.data;
  await withSession(session, (tx) => saveCisSettings(tx, session.orgId, { enabled: d.enabled, contractorUtr: d.contractorUtr ?? null, employerRef: d.employerRef ?? null, accountsOfficeRef: d.accountsOfficeRef ?? null }));
  revalidatePath("/app", "layout");
  return { ok: true };
}

/** A subcontractor's UTR and verified CIS status. Needs to edit the team and see costs. */
export async function saveWorkerCisAction(workerId: string, input: unknown): Promise<CisActionResult> {
  const session = await getSession();
  if (!can(session.role, "team.edit") || !can(session.role, "costs.view")) return { ok: false, message: "Only Admins and the office can change CIS details." };
  if (!id.safeParse(workerId).success) return { ok: false, message: "This person was removed. Reload the page." };
  const parsed = workerCisInput.safeParse(input);
  if (!parsed.success) {
    const field = String(parsed.error.issues[0]?.path[0] ?? "");
    const labels: Record<string, string> = { utr: "A UTR is 10 digits.", verificationRef: "Check the verification number, e.g. V1234567890.", verifiedOn: "Check the date." };
    return { ok: false, message: labels[field] ?? "Check what you've entered." };
  }
  const d = parsed.data;
  const saved = await withSession(session, (tx) => saveWorkerCis(tx, session.orgId, workerId, { status: d.status ?? null, utr: d.utr ?? null, verificationRef: d.verificationRef ?? null, verifiedOn: d.verifiedOn ?? null }));
  if (!saved) return { ok: false, message: "CIS details are for subcontractors. Change them to a subcontractor first." };
  revalidatePath(`/app/team/${workerId}`);
  return { ok: true };
}
