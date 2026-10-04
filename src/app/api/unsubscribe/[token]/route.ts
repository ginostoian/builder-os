import { findLeadForUnsubscribe, withTenant } from "@/db";
import { optOut } from "@/db/pipeline";

export const dynamic = "force-dynamic";

/** One-click unsubscribe (RFC 8058): mail apps POST here from their own "Unsubscribe" button. */
export async function POST(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const found = await findLeadForUnsubscribe((await params).token);
  if (found) await withTenant(found.orgId, (tx) => optOut(tx, found.orgId, found.leadId));
  return new Response(null, { status: 204 });
}
