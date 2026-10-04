"use server";

import { revalidatePath } from "next/cache";
import { id } from "@/core/schemas";
import { withPlatform } from "@/db";
import { setComped } from "@/db/billing";
import { platformAccess } from "@/auth/platform-admin";

/** Make a company complimentary Pro, or stop. Website owner's admins only. */
export async function setCompedAction(orgId: string, comped: boolean): Promise<{ ok: boolean; message?: string }> {
  if (!(await platformAccess()).ok) return { ok: false, message: "Not allowed." };
  if (!id.safeParse(orgId).success) return { ok: false, message: "Unknown company." };
  const done = await withPlatform((tx) => setComped(tx, orgId, comped === true));
  revalidatePath("/admin", "layout");
  return done ? { ok: true } : { ok: false, message: "Unknown company." };
}
