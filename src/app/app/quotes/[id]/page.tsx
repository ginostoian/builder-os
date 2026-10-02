import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LiveAppShell } from "@/components/app/live-app-shell";
import { QuoteBuilder } from "@/components/app/quotes/quote-builder";
import { quoteRef } from "@/core/quote";
import { id as uuid } from "@/core/schemas";
import { clientOptions } from "@/db/clients";
import { getQuote, libraryForQuotes } from "@/db/quotes";
import { requirePermission, withSession } from "@/auth/session";

export const metadata: Metadata = { title: "Quote" };

export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePermission("quotes.edit");
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();

  const data = await withSession(session, async (tx) => {
    const loaded = await getQuote(tx, session.orgId, id);
    if (!loaded) return undefined;
    return {
      loaded,
      clients: await clientOptions(tx, session.orgId, loaded.quote.clientId),
      library: await libraryForQuotes(tx, session.orgId),
    };
  });
  if (!data) notFound();
  const { loaded, clients, library } = data;
  const q = loaded.quote;

  return (
    <LiveAppShell active="quote" crumbs={["Quotes", `${quoteRef(q.number)} · ${q.title}`]}>
      {q.status === "draft" ? (
        <QuoteBuilder
          key={q.id}
          initial={{
            id: q.id,
            number: q.number,
            status: q.status,
            version: q.version,
            title: q.title,
            clientId: q.clientId,
            siteAddress: q.siteAddress,
            validUntil: q.validUntil,
            markupBps: q.markupBps,
            vatRateBps: q.vatRateBps,
            sections: loaded.sections,
          }}
          clients={clients}
          library={library}
          clientName={loaded.client?.name ?? ""}
        />
      ) : (
        <div className="p-6 text-ink-2">This quote has been sent. Viewing sent quotes comes with sending.</div>
      )}
    </LiveAppShell>
  );
}
