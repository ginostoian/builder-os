"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { can } from "@/core/roles";
import { xeroSettings } from "@/core/xero";
import { getSession, withSession } from "@/auth/session";
import { deleteXeroConnection, getXeroConnection, queueXeroInvoicesSince, retryFailedXeroJobs, saveXeroSettings } from "@/db/xero";
import { appOrigin } from "@/server/origin";
import { hasFeature, upgradeMessage } from "@/server/plan";
import { authorizeUrl, removeTenant, revokeRefreshToken, xeroConfigured } from "@/server/xero/client";
import { createJobsCategory } from "@/server/xero/setup";
import { startXeroState, xeroRedirectUri } from "@/server/xero/state";
import { runXeroSync } from "@/server/xero/sync";
import { openToken } from "@/server/xero/tokens";

export type XeroActionResult = { ok: true; message?: string; url?: string } | { ok: false; message: string };

const NOT_ADMIN = "Only an Admin can change the Xero connection.";
const PAGE = "/app/settings/xero";

async function admin() {
  const session = await getSession();
  return can(session.role, "settings.manage") ? session : null;
}

/** Start connecting: Xero's sign-in page, then back to /api/xero/callback. */
export async function connectXeroAction(): Promise<XeroActionResult> {
  const session = await admin();
  if (!session) return { ok: false, message: NOT_ADMIN };
  if (!xeroConfigured()) return { ok: false, message: "Xero isn't available yet. Contact Builder OS support." };
  if (!(await hasFeature("invoicing"))) return { ok: false, message: upgradeMessage("invoicing") };
  const state = await startXeroState(session.orgId);
  return { ok: true, url: authorizeUrl(xeroRedirectUri(await appOrigin()), state) };
}

export async function saveXeroSettingsAction(input: unknown): Promise<XeroActionResult> {
  const session = await admin();
  if (!session) return { ok: false, message: NOT_ADMIN };
  const parsed = xeroSettings.safeParse(input);
  if (!parsed.success) {
    const field = String(parsed.error.issues[0]?.path[0] ?? "");
    const labels: Record<string, string> = {
      salesAccountCode: "Choose the account your sales go to.",
      syncFrom: "Enter the date to start sending invoices from.",
      numberPrefix: "Keep the prefix to letters, numbers and dashes, up to 10.",
    };
    return { ok: false, message: labels[field] ?? "Check the settings and try again." };
  }
  const saved = await withSession(session, (tx) => saveXeroSettings(tx, session.orgId, parsed.data));
  if (!saved) return { ok: false, message: "Connect Xero first." };
  revalidatePath(PAGE);
  return { ok: true, message: "Saved." };
}

/** Send invoices issued since the start date (the ones already there are matched, not duplicated). */
export async function sendPastInvoicesAction(): Promise<XeroActionResult> {
  const session = await admin();
  if (!session) return { ok: false, message: NOT_ADMIN };
  const conn = await withSession(session, (tx) => getXeroConnection(tx, session.orgId));
  if (!conn?.settings) return { ok: false, message: "Connect Xero first." };
  const n = await withSession(session, (tx) => queueXeroInvoicesSince(tx, session.orgId, conn.settings!.syncFrom));
  after(() => runXeroSync(session.orgId, 40));
  revalidatePath(PAGE);
  return { ok: true, message: n ? `Sending ${n} invoice${n === 1 ? "" : "s"} to Xero. This page shows how it's going.` : "There are no invoices from that date yet." };
}

/** Try everything that's stuck again, now. */
export async function retryXeroAction(): Promise<XeroActionResult> {
  const session = await admin();
  if (!session) return { ok: false, message: NOT_ADMIN };
  await withSession(session, (tx) => retryFailedXeroJobs(tx, session.orgId));
  const r = await runXeroSync(session.orgId, 20);
  revalidatePath(PAGE);
  return { ok: true, message: r.failed ? `${r.done} sent, ${r.failed} still need attention.` : r.done ? `All ${r.done} sent.` : "Nothing was waiting." };
}

export async function createJobsCategoryAction(): Promise<XeroActionResult> {
  const session = await admin();
  if (!session) return { ok: false, message: NOT_ADMIN };
  const conn = await withSession(session, (tx) => getXeroConnection(tx, session.orgId));
  if (!conn?.settings) return { ok: false, message: "Connect Xero first." };
  const id = await createJobsCategory(session.orgId).catch(() => undefined);
  if (!id) return { ok: false, message: "Xero already has two tracking categories, its limit. Choose one of them instead, or archive one in Xero." };
  await withSession(session, (tx) => saveXeroSettings(tx, session.orgId, { ...conn.settings!, trackJobs: true, trackingCategoryId: id }));
  revalidatePath(PAGE);
  return { ok: true, message: "Added a Jobs tracking category in Xero." };
}

/** Disconnect: remove Builder OS from the Xero organisation and forget the tokens. Nothing in Xero is deleted. */
export async function disconnectXeroAction(): Promise<XeroActionResult> {
  const session = await admin();
  if (!session) return { ok: false, message: NOT_ADMIN };
  const conn = await withSession(session, (tx) => getXeroConnection(tx, session.orgId));
  if (conn) {
    const access = openToken(conn.accessToken);
    const refresh = openToken(conn.refreshToken);
    if (access) await removeTenant(access, conn.connectionId);
    if (refresh) await revokeRefreshToken(refresh);
    await withSession(session, (tx) => deleteXeroConnection(tx, session.orgId));
  }
  revalidatePath(PAGE);
  return { ok: true, message: "Disconnected. Everything already in Xero stays there." };
}
