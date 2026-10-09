"use server";

import { revalidatePath } from "next/cache";
import { estimatorSettings } from "@/core/estimator";
import { can } from "@/core/roles";
import { saveEstimatorSettings, setEstimatorLink } from "@/db/estimator";
import { getSession, withSession } from "@/auth/session";

export type EstimatorActionResult = { ok: true } | { ok: false; message: string };

/** Save what the website estimator offers and how it prices. Admin only. */
export async function saveEstimatorAction(input: unknown): Promise<EstimatorActionResult> {
  const session = await getSession();
  if (!can(session.role, "settings.manage")) return { ok: false, message: "Only an Admin can change the estimator." };
  const parsed = estimatorSettings.safeParse(input);
  if (!parsed.success) {
    const field = String(parsed.error.issues[0]?.path[0] ?? "");
    const labels: Record<string, string> = {
      types: "Choose at least one project.",
      adjustPct: "Keep the adjustment between -40% and +100%.",
      prices: "Your own prices should be whole pounds, between £100 and £1,000,000.",
      headline: "Keep the heading under 80 characters.",
    };
    return { ok: false, message: labels[field] ?? "Check what you've entered." };
  }
  await withSession(session, (tx) => saveEstimatorSettings(tx, session.orgId, parsed.data));
  revalidatePath("/app/settings/estimator");
  return { ok: true };
}

/** Turn the estimator on (a new link), make a new link (old embeds stop working), or turn it off. Admin only. */
export async function setEstimatorLinkAction(on: boolean): Promise<EstimatorActionResult> {
  const session = await getSession();
  if (!can(session.role, "settings.manage")) return { ok: false, message: "Only an Admin can change the estimator." };
  await withSession(session, (tx) => setEstimatorLink(tx, session.orgId, on === true));
  revalidatePath("/app/settings/estimator");
  return { ok: true };
}
