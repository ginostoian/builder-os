"use server";

import { findLeadForUnsubscribe, withTenant } from "@/db";
import { optOut } from "@/db/pipeline";

export async function unsubscribeAction(token: string): Promise<{ ok: boolean }> {
  const found = typeof token === "string" ? await findLeadForUnsubscribe(token) : null;
  if (!found) return { ok: false };
  await withTenant(found.orgId, (tx) => optOut(tx, found.orgId, found.leadId));
  return { ok: true };
}
