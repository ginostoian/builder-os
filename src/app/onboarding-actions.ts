"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { STEP_IDS } from "@/core/onboarding";
import { ukToday } from "@/core/payment-plan";
import { can } from "@/core/roles";
import { changeOnboarding } from "@/db/onboarding";
import { addSampleData, declineSampleData, removeSampleData, SampleDataInUse } from "@/db/sample-data";
import { getSession, withSession } from "@/auth/session";

const change = z.discriminatedUnion("op", [
  z.strictObject({ op: z.enum(["tour_done", "tour_reset", "hide", "show", "reset_skipped"]) }),
  z.strictObject({ op: z.enum(["skip", "unskip"]), step: z.enum(STEP_IDS as [string, ...string[]]) }),
]);

/** The signed-in person's own tour and checklist choices. */
export async function onboardingAction(input: unknown): Promise<{ ok: boolean }> {
  const parsed = change.safeParse(input);
  if (!parsed.success) return { ok: false };
  const s = await getSession();
  await withSession(s, (tx) => changeOnboarding(tx, s.orgId, s.memberId, parsed.data));
  revalidatePath("/app", "layout");
  return { ok: true };
}

/** A new company's answer to "add example data?": add it, or not. Admins only; asked once per company. */
export async function sampleDataAction(choice: "add" | "decline"): Promise<{ ok: boolean; message?: string }> {
  const s = await getSession();
  if (!can(s.role, "settings.manage")) return { ok: false, message: "Only an Admin can add example data." };
  if (choice === "add") {
    try {
      await withSession(s, (tx) => addSampleData(tx, s.orgId, s.memberId, ukToday()));
    } catch (error) {
      if (error instanceof SampleDataInUse) return { ok: false, message: "You've already started adding your own work, so we won't mix examples in with it." };
      throw error;
    }
  }
  else if (choice === "decline") await withSession(s, (tx) => declineSampleData(tx, s.orgId));
  else return { ok: false };
  revalidatePath("/app", "layout");
  return { ok: true };
}

/** Remove every example record, leaving the company's own work as it is. */
export async function removeSampleDataAction(): Promise<{ ok: boolean; message?: string }> {
  const s = await getSession();
  if (!can(s.role, "settings.manage")) return { ok: false, message: "Only an Admin can remove example data." };
  try {
    await withSession(s, (tx) => removeSampleData(tx, s.orgId));
  } catch (error) {
    if (error instanceof SampleDataInUse)
      return { ok: false, message: "Some of your own work uses the examples (an invoice or job on an example quote, say). Void or delete those first, then try again." };
    throw error;
  }
  revalidatePath("/app", "layout");
  return { ok: true, message: "Example data removed. Everything you added yourself is still here." };
}

