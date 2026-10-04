import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PortalQuote } from "@/components/portal/portal-quote";
import { withTenant } from "@/db";
import { PortalBlocked } from "@/components/portal/portal-gate";
import { requirePortal } from "@/server/portal-auth";
import { portalQuote } from "@/db/portal";

type Params = Promise<{ token: string; number: string }>;

async function load(params: Params) {
  const { token, number } = await params;
  const n = /^\d{1,9}$/.test(number) ? Number(number) : null;
  const access = n ? await requirePortal(token) : null;
  if (!access || !n) return null;
  const quote = await withTenant(access.orgId, (tx) => portalQuote(tx, access.orgId, access.clientId, n));
  return quote ? { token, quote } : null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const data = await load(params);
  if (!data) return { title: { absolute: "Quote" } };
  const s = data.quote.version.snapshot;
  return { title: { absolute: `${s.quote.title} · ${s.company.tradingName ?? s.company.name}` } };
}

/** One quote in the client's portal, rendered from the last version sent. */
export default async function PortalQuotePage({ params }: { params: Params }) {
  const data = await load(params);
  if (!data) return <PortalBlocked token={(await params).token} />;
  const { quote } = data;
  return (
    <PortalQuote
      token={data.token}
      snapshot={quote.version.snapshot}
      version={{ versionNo: quote.version.versionNo, sentAt: quote.version.sentAt, contentHash: quote.version.contentHash }}
      decision={quote.decision}
      comments={quote.comments}
      revising={quote.revising}
      expired={quote.expired}
    />
  );
}
