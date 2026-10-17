import { after } from "next/server";
import { validWebhookSignature, webhookPayload } from "@/core/xero";
import { findOrgByXeroTenant, withTenant } from "@/db";
import { invoiceForXeroId } from "@/db/xero";
import { pullPayments } from "@/server/xero/sync";

export const dynamic = "force-dynamic";

/**
 * Xero tells us when an invoice changes (a payment recorded in Xero is an invoice update). It wants 200 for
 * a correctly signed delivery and 401 for anything else, both empty and within 5 seconds, so the work
 * happens after the reply: each changed invoice that's ours and still open is checked and marked paid.
 */
export async function POST(request: Request) {
  const key = process.env.XERO_WEBHOOK_KEY?.trim();
  const raw = await request.text();
  if (!key || !validWebhookSignature(raw, request.headers.get("x-xero-signature"), key)) return new Response(null, { status: 401 });
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response(null, { status: 200 });
  }
  const parsed = webhookPayload.safeParse(body);
  if (parsed.success && parsed.data.events.length) {
    const byTenant = new Map<string, Set<string>>();
    for (const e of parsed.data.events) {
      if (e.eventCategory !== "INVOICE") continue;
      byTenant.set(e.tenantId, (byTenant.get(e.tenantId) ?? new Set()).add(e.resourceId));
    }
    after(async () => {
      for (const [tenantId, ids] of byTenant) {
        try {
          const orgId = await findOrgByXeroTenant(tenantId);
          if (!orgId) continue;
          const ours = (await withTenant(orgId, async (tx) => Promise.all([...ids].map((id) => invoiceForXeroId(tx, orgId, id))))).filter((id): id is string => Boolean(id));
          if (ours.length) await pullPayments(orgId, ours);
        } catch (error) {
          console.error("Xero webhook processing failed", error instanceof Error ? error.message : error);
        }
      }
    });
  }
  return new Response(null, { status: 200 });
}
