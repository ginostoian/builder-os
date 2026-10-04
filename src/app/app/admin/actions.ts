"use server";

import { revalidatePath } from "next/cache";
import { id } from "@/core/schemas";
import { getSession, withSession } from "@/auth/session";
import { setComped } from "@/db/billing";
import { isPlatformAdmin } from "@/server/platform-admin";

/** Make a company complimentary Pro, or stop. Platform team only. */
export async function setCompedAction(orgId: string, comped: boolean): Promise<{ ok: boolean; message?: string }> {
  if (!(await isPlatformAdmin())) return { ok: false, message: "Not allowed." };
  if (!id.safeParse(orgId).success) return { ok: false, message: "Unknown company." };
  const s = await getSession();
  const done = await withSession(s, (tx) => setComped(tx, orgId, comped === true));
  revalidatePath("/app/admin");
  return done ? { ok: true } : { ok: false, message: "Unknown company." };
}
