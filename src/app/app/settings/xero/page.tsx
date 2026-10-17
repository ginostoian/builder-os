import type { Metadata } from "next";
import { after } from "next/server";
import { and, eq } from "drizzle-orm";
import { LiveAppShell } from "@/components/app/live-app-shell";
import { SettingsFrame } from "@/components/app/settings/settings-frame";
import { XeroSettingsPanel, type XeroView } from "@/components/app/settings/xero-settings";
import { can } from "@/core/roles";
import { planAllows } from "@/db/billing";
import { quotes } from "@/db/schema";
import { getXeroConnection, xeroActivity } from "@/db/xero";
import { requirePermission, withSession } from "@/auth/session";
import { onlinePaymentsReady } from "@/server/payments";
import { xeroConfigured, XeroApiError } from "@/server/xero/client";
import { xeroChoices } from "@/server/xero/setup";
import { runXeroSync } from "@/server/xero/sync";

export const metadata: Metadata = { title: "Xero" };

const NOTICES: Record<string, { ok: boolean; text: string }> = {
  connected: { ok: true, text: "Connected. New invoices now go to Xero automatically. Check the choices below, then you're done." },
  state: { ok: false, text: "That connection attempt had expired. Press Connect to Xero again." },
  cancelled: { ok: false, text: "Xero wasn't connected. Press Connect to Xero to try again." },
  not_allowed: { ok: false, text: "Only an Admin on the Essentials or Pro plan can connect Xero." },
  failed: { ok: false, text: "Xero didn't finish connecting. Please try again in a minute." },
  taken: { ok: false, text: "That Xero organisation is already connected to another company in Builder OS. Disconnect it there first, or choose a different organisation." },
};

/** Settings, Xero: connect the company's Xero, choose where things go, and see what's been sent. */
export default async function XeroSettingsPage({ searchParams }: { searchParams: Promise<{ connected?: string; error?: string; extra?: string }> }) {
  const session = await requirePermission("settings.view");
  const q = await searchParams;
  const notice = q.connected
    ? { ...NOTICES.connected, text: `${NOTICES.connected.text}${q.extra ? " You chose more than one organisation, so we kept the first." : ""}` }
    : q.error
      ? (NOTICES[q.error] ?? NOTICES.failed)
      : null;

  const data = await withSession(session, async (tx) => ({
    allowed: await planAllows(tx, session.orgId, "invoicing"),
    conn: await getXeroConnection(tx, session.orgId),
    activity: await xeroActivity(tx, session.orgId),
    usesReverseCharge:
      (
        await tx
          .select({ id: quotes.id })
          .from(quotes)
          .where(and(eq(quotes.orgId, session.orgId), eq(quotes.vatTreatment, "reverse_charge")))
          .limit(1)
      ).length > 0,
    online: Boolean(await onlinePaymentsReady(tx, session.orgId)),
  }));

  let view: XeroView;
  if (!xeroConfigured()) view = { state: "unavailable" };
  else if (!data.allowed) view = { state: "upgrade" };
  else if (!data.conn) view = { state: "disconnected" };
  else {
    const active = data.conn.status === "active";
    const choices =
      active && data.conn.settings
        ? await xeroChoices(session.orgId).then(
            (c) => ({ c, e: null }),
            (e) => ({ c: null, e: e instanceof XeroApiError ? e.message : "Couldn't reach Xero just now." }),
          )
        : { c: null, e: null };
    view = {
      state: active ? "connected" : "reconnect",
      tenantName: data.conn.tenantName,
      lastError: data.conn.lastError,
      lastSyncedAt: data.conn.lastSyncedAt?.toISOString() ?? null,
      settings: data.conn.settings,
      choices: choices.c,
      choicesError: choices.e,
      usesReverseCharge: data.usesReverseCharge,
      takesOnlinePayments: data.online,
      activity: { ...data.activity, recent: data.activity.recent.map((j) => ({ ...j, updatedAt: j.updatedAt.toISOString() })) },
    };
    // Anything waiting gets another go while they look.
    if (active && data.activity.pending > 0) after(() => runXeroSync(session.orgId, 10));
  }

  return (
    <LiveAppShell active="settings" crumbs={["Settings", "Xero"]}>
      <SettingsFrame active="xero" title="Xero" subtitle="Your invoices and payments in Xero automatically, with the right VAT codes and each job tagged.">
        <XeroSettingsPanel view={view} canEdit={can(session.role, "settings.manage")} notice={notice} />
      </SettingsFrame>
    </LiveAppShell>
  );
}
