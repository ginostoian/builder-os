import { withFreshPhotos } from "@/server/variation-photos";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LiveAppShell } from "@/components/app/live-app-shell";
import { VariationEditor } from "@/components/app/variations/variation-editor";
import { VariationView } from "@/components/app/variations/variation-view";
import { quoteRef } from "@/core/quote";
import { can } from "@/core/roles";
import { id as uuid } from "@/core/schemas";
import { variationRef } from "@/core/variation";
import { paymentSettings } from "@/db/invoices";
import { currentPortalToken } from "@/db/sending";
import { getVariation } from "@/db/variations";
import { libraryForQuotes } from "@/db/quotes";
import { privateUrl, storageConfigured } from "@/server/storage";
import { requirePermission, withSession } from "@/auth/session";
import { emailConfigured } from "@/server/email";
import { appOrigin, portalVariationUrl } from "@/server/origin";

export const metadata: Metadata = { title: "Variation" };

export default async function VariationPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePermission("quotes.edit");
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();
  const data = await withSession(session, async (tx) => {
    const found = await getVariation(tx, session.orgId, id);
    if (!found) return undefined;
    return {
      found,
      token: await currentPortalToken(tx, session.orgId, found.variation.clientId),
      bankReady: Boolean((await paymentSettings(tx, session.orgId))?.bankSortCode),
      library: found.variation.status === "draft" ? await libraryForQuotes(tx, session.orgId) : [],
    };
  });
  if (!data) notFound();
  const { found } = data;
  const v = found.variation;
  const ref = variationRef(found.quoteNumber, v.number);
  const crumbs: [string, string] = ["Quotes", `${ref} · ${v.title}`];

  if (v.status === "draft") {
    return (
      <LiveAppShell active="quote" crumbs={crumbs}>
        <VariationEditor
          key={v.id}
          variation={{ id: v.id, ref, title: v.title, reason: v.reason, lines: v.lines, vatRateBps: v.vatRateBps, quoteId: v.quoteId, quoteRef: quoteRef(found.quoteNumber), quoteTitle: found.quoteTitle }}
          defaultMarkupBps={found.quoteMarkupBps}
          clientName={found.clientName}
          clientEmail={found.clientEmail}
          clientPhone={found.clientPhone}
          emailEnabled={emailConfigured()}
          library={data.library}
          photos={v.photos.map((p) => ({ key: p.key, url: privateUrl(p.key) }))}
          storageEnabled={storageConfigured()}
        />
      </LiveAppShell>
    );
  }

  return (
    <LiveAppShell active="quote" crumbs={crumbs}>
      <VariationView
        id={v.id}
        quoteId={v.quoteId}
        status={v.status}
        snapshot={withFreshPhotos(v.snapshot!)}
        sentAt={v.sentAt!}
        link={data.token ? portalVariationUrl(await appOrigin(), data.token, found.quoteNumber, v.number) : null}
        decision={v.decidedAt ? { at: v.decidedAt, name: v.decisionName ?? "", signature: v.signature, reason: v.decisionReason, ip: v.decisionIp } : null}
        contentHash={v.contentHash ?? ""}
        invoice={found.billed && v.invoiceId ? { id: v.invoiceId, number: found.invoiceNumber! } : null}
        canEdit
        canInvoice={can(session.role, "invoices.manage")}
        bankReady={data.bankReady}
        clientName={found.clientName}
        clientPhone={found.clientPhone}
      />
    </LiveAppShell>
  );
}
