"use server";

import { allow, perIp } from "@/server/rate-limit";
import { findLeadForUnsubscribe, withTenant } from "@/db";
import { optOut } from "@/db/pipeline";

export async function unsubscribeAction(token: string): Promise<{ ok: boolean }> {
  if (!(await allow(await perIp("unsubscribe_ip", 120, 3_600)))) return { ok: false };
  const found = typeof token === "string" ? await findLeadForUnsubscribe(token) : null;
  if (!found) return { ok: false };
  await withTenant(found.orgId, (tx) => optOut(tx, found.orgId, found.leadId));
  return { ok: true };
}
