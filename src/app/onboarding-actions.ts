"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { STEP_IDS } from "@/core/onboarding";
import { changeOnboarding } from "@/db/onboarding";
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
