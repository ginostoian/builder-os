import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LiveAppShell } from "@/components/app/live-app-shell";
import { QuoteBuilder } from "@/components/app/quotes/quote-builder";
import { SentQuote } from "@/components/app/quotes/sent-quote";
import { quoteRef } from "@/core/quote";
import { id as uuid } from "@/core/schemas";
import { clientOptions } from "@/db/clients";
import { getQuote, libraryForQuotes } from "@/db/quotes";
import { currentPortalToken, latestVersion, quoteActivity } from "@/db/sending";
import { paymentSettings, quoteSchedule } from "@/db/invoices";
import { rechargesForQuote } from "@/db/costs";
import { applyBps } from "@/core/money";
import { billableVariations, quoteVariations } from "@/db/variations";
import { projectForQuote } from "@/db/projects";
import { can } from "@/core/roles";
import { requirePermission, withSession } from "@/auth/session";
import { emailConfigured } from "@/server/email";
import { appOrigin, portalUrl } from "@/server/origin";

export const metadata: Metadata = { title: "Quote" };

export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePermission("quotes.edit");
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();

  const data = await withSession(session, async (tx) => {
    const loaded = await getQuote(tx, session.orgId, id);
    if (!loaded) return undefined;
    const activity = await quoteActivity(tx, session.orgId, id);
    if (loaded.quote.status === "draft") {
      return {
        kind: "draft" as const,
        loaded,
        sentVersions: activity.versions.length,
        clients: await clientOptions(tx, session.orgId, loaded.quote.clientId),
        library: await libraryForQuotes(tx, session.orgId),
      };
    }
    return {
      kind: "sent" as const,
      loaded,
      activity,
      version: (await latestVersion(tx, session.orgId, id))!,
      token: await currentPortalToken(tx, session.orgId, loaded.quote.clientId),
      schedule: loaded.quote.status === "accepted" ? await quoteSchedule(tx, session.orgId, id) : null,
      bankReady: Boolean((await paymentSettings(tx, session.orgId))?.bankSortCode),
      variations: loaded.quote.status === "accepted" ? await quoteVariations(tx, session.orgId, id) : null,
      billable: loaded.quote.status === "accepted" ? await billableVariations(tx, session.orgId, id) : [],
      recharges: loaded.quote.status === "accepted" ? await rechargesForQuote(tx, session.orgId, id) : [],
      projectId: loaded.quote.status === "accepted" ? await projectForQuote(tx, session.orgId, id) : null,
    };
  });
  if (!data) notFound();
  const q = data.loaded.quote;
  const crumbs: [string, string] = ["Quotes", `${quoteRef(q.number)} · ${q.title}`];

  if (data.kind === "draft") {
    return (
      <LiveAppShell active="quote" crumbs={crumbs}>
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
            sections: data.loaded.sections,
            paymentPlan: q.paymentPlan ?? [],
          }}
          clients={data.clients}
          library={data.library}
          clientName={data.loaded.client?.name ?? ""}
          clientEmail={data.loaded.client?.email ?? null}
          emailEnabled={emailConfigured()}
          sentVersions={data.sentVersions}
        />
      </LiveAppShell>
    );
  }

  const { activity, version } = data;
  return (
    <LiveAppShell active="quote" crumbs={crumbs}>
      <SentQuote
        quoteId={q.id}
        status={q.status}
        clientName={data.loaded.client?.name ?? ""}
        clientId={q.clientId}
        snapshot={version.snapshot}
        version={{ versionNo: version.versionNo, sentAt: version.sentAt, contentHash: version.contentHash }}
        link={data.token ? portalUrl(await appOrigin(), data.token, q.number) : null}
        events={activity.events}
        comments={activity.comments}
        decision={activity.decisions.find((d) => d.versionId === version.id) ?? null}
        viewCount={activity.viewCount}
        lastViewedAt={activity.lastViewedAt}
        versionCount={activity.versions.length}
        schedule={data.schedule}
        canInvoice={can(session.role, "invoices.manage")}
        bankReady={data.bankReady}
        emailEnabled={emailConfigured()}
        clientEmail={data.loaded.client?.email ?? null}
        variations={data.variations}
        billable={data.billable.map((v) => ({ id: v.id, number: v.number, title: v.title, totalPence: v.totalPence }))}
        recharges={data.recharges.map((r) => ({ id: r.id, description: r.description, supplier: r.supplier, totalPence: r.amount + applyBps(r.amount, version.snapshot.quote.vatRateBps) }))}
        canEdit
        project={{ id: data.projectId, canStart: can(session.role, "projects.edit") }}
      />
    </LiveAppShell>
  );
}
