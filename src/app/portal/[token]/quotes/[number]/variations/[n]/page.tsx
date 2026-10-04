import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PortalVariation } from "@/components/portal/portal-variation";
import { withTenant } from "@/db";
import { PortalBlocked } from "@/components/portal/portal-gate";
import { requirePortal } from "@/server/portal-auth";
import { portalVariation } from "@/db/variations";

type Params = Promise<{ token: string; number: string; n: string }>;
const num = (s: string) => (/^\d{1,9}$/.test(s) ? Number(s) : null);

async function load(params: Params) {
  const { token, number, n } = await params;
  const q = num(number);
  const v = num(n);
  const access = q && v ? await requirePortal(token) : null;
  if (!access || !q || !v) return null;
  const variation = await withTenant(access.orgId, (tx) => portalVariation(tx, access.orgId, access.clientId, q, v));
  return variation ? { token, variation } : null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const data = await load(params);
  if (!data) return { title: { absolute: "Variation" } };
  const s = data.variation.snapshot;
  return { title: { absolute: `${s.title} · ${s.company.tradingName ?? s.company.name}` } };
}

/** A variation in the client's portal, rendered from what they were sent. */
export default async function PortalVariationPage({ params }: { params: Params }) {
  const data = await load(params);
  if (!data) return <PortalBlocked token={(await params).token} />;
  const v = data.variation;
  return (
    <PortalVariation
      token={data.token}
      snapshot={v.snapshot}
      sentAt={v.sentAt}
      status={v.status}
      decision={v.decidedAt ? { at: v.decidedAt, name: v.decisionName ?? "", signature: v.signature } : null}
      contentHash={v.contentHash ?? ""}
    />
  );
}
