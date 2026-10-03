import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PortalQuote } from "@/components/portal/portal-quote";
import { isExpired } from "@/core/quote-snapshot";
import { id as uuid } from "@/core/schemas";
import { getQuote } from "@/db/quotes";
import { latestVersion, quoteActivity } from "@/db/sending";
import { requirePermission, withSession } from "@/auth/session";

export const metadata: Metadata = { title: "Preview" };

/** "Preview as client": the portal page, signed in as the team, with nothing recorded. */
export default async function QuotePreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePermission("quotes.edit");
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();
  const data = await withSession(session, async (tx) => {
    const loaded = await getQuote(tx, session.orgId, id);
    const version = loaded && (await latestVersion(tx, session.orgId, id));
    if (!loaded || !version) return undefined;
    return { loaded, version, activity: await quoteActivity(tx, session.orgId, id) };
  });
  if (!data) notFound();
  const { loaded, version, activity } = data;
  const decision = activity.decisions.find((d) => d.versionId === version.id) ?? null;
  return (
    <PortalQuote
      token={null}
      snapshot={version.snapshot}
      version={{ versionNo: version.versionNo, sentAt: version.sentAt, contentHash: version.contentHash }}
      decision={decision}
      comments={activity.comments}
      revising={loaded.quote.status === "draft"}
      expired={isExpired(version.snapshot.quote.validUntil)}
    />
  );
}
