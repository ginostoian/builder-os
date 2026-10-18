"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ASSIGNABLE_ROLES, can } from "@/core/roles";
import { getSession, withSession } from "@/auth/session";
import { setMemberRole } from "@/db/team";

const input = z.strictObject({ memberId: z.uuid(), role: z.enum(ASSIGNABLE_ROLES) });

/** Change someone's role (Office, Estimator, Site lead or Employee). Admins only; Admin itself is given in Clerk. */
export async function setMemberRoleAction(raw: unknown): Promise<{ ok: true } | { ok: false; message: string }> {
  const session = await getSession();
  if (!can(session.role, "team.manage")) return { ok: false, message: "Only an Admin can change roles." };
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Choose a role." };
  if (parsed.data.memberId === session.memberId) return { ok: false, message: "You can't change your own role." };
  const changed = await withSession(session, (tx) => setMemberRole(tx, session.orgId, parsed.data.memberId, parsed.data.role, session.memberId));
  if (!changed) return { ok: false, message: "That person is an Admin or has left. Admins are changed in the members list below." };
  revalidatePath("/app/settings/team");
  return { ok: true };
}
