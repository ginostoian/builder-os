"use server";

import { revalidatePath } from "next/cache";
import { can } from "@/core/roles";
import { id } from "@/core/schemas";
import { ensurePortalToken, rotatePortalToken } from "@/db/sending";
import { getSession, withSession } from "@/auth/session";
import { appOrigin, portalUrl } from "@/server/origin";

export type PortalLinkResult = { ok: true; link: string } | { ok: false; message: string };

/** The client's portal link, created on first use. Anyone who can see quotes can copy it. */
export async function getPortalLink(clientId: string): Promise<PortalLinkResult> {
  const session = await getSession();
  if (!can(session.role, "quotes.edit")) return { ok: false, message: "Your role can't share client links." };
  if (!id.safeParse(clientId).success) return { ok: false, message: "This client no longer exists." };
  const token = await withSession(session, (tx) => ensurePortalToken(tx, session.orgId, clientId));
  return { ok: true, link: portalUrl(await appOrigin(), token) };
}

/** Kill the current link (e.g. sent to the wrong person) and issue a new one. */
export async function resetPortalLink(clientId: string): Promise<PortalLinkResult> {
  const session = await getSession();
  if (!can(session.role, "clients.manage")) return { ok: false, message: "Your role can't reset client links." };
  if (!id.safeParse(clientId).success) return { ok: false, message: "This client no longer exists." };
  const token = await withSession(session, (tx) => rotatePortalToken(tx, session.orgId, clientId));
  revalidatePath(`/app/clients/${clientId}`);
  return { ok: true, link: portalUrl(await appOrigin(), token) };
}
