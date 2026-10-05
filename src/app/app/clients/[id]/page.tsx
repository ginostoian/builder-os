import type { Metadata } from "next";
import { WhatsAppLink } from "@/components/app/whatsapp-button";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, Mail, Phone, Plus } from "lucide-react";
import { LiveAppShell } from "@/components/app/live-app-shell";
import { Panel } from "@/components/app/app-shell";
import { ArchivePanel } from "@/components/app/archive-panel";
import { PortalLinkPanel } from "@/components/app/clients/portal-link";
import { getPortalSignIn, portalDevices } from "@/db/portal-auth";
import { emailConfigured } from "@/server/email";
import { ClientForm } from "@/components/app/clients/client-form";
import { SectionHeading } from "@/components/app/form-fields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatGBP } from "@/core/money";
import { quoteRef } from "@/core/quote";
import { can } from "@/core/roles";
import { id as uuid } from "@/core/schemas";
import { countClientQuotes, getClient } from "@/db/clients";
import { listQuotes } from "@/db/quotes";
import { requirePermission, withSession } from "@/auth/session";
import { archiveClient, removeClient } from "../actions";

export const metadata: Metadata = { title: "Client" };

const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" });

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePermission("clients.view");
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();

  const found = await withSession(session, async (tx) => {
    const client = await getClient(tx, session.orgId, id);
    return (
      client && {
        client,
        quoteCount: await countClientQuotes(tx, session.orgId, id),
        // Quote totals are prices, so only roles that work on quotes see them.
        clientQuotes: can(session.role, "quotes.edit") ? (await listQuotes(tx, session.orgId, { clientId: id })).quotes : [],
        portalSignIn: await getPortalSignIn(tx, session.orgId),
        portalDevices: (await portalDevices(tx, session.orgId, id)).length,
      }
    );
  });
  if (!found) notFound();
  const { client, quoteCount, clientQuotes } = found;
  const canQuote = can(session.role, "quotes.edit");
  const canManage = can(session.role, "clients.manage");

  return (
    <LiveAppShell active="crm" crumbs={["Clients", client.name]}>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto bg-surface-2 px-4 py-[18px] lg:px-6">
        <div className="flex flex-col gap-2">
          <Link href={client.archivedAt ? "/app/clients?view=archived" : "/app/clients"} className="flex w-fit items-center gap-1 text-ink-2 hover:text-ink">
            <ArrowLeft className="size-3.5" />
            Clients
          </Link>
          <div className="flex items-center gap-2.5">
            <h1 className="text-[19px] font-semibold tracking-[-0.02em]">{client.name}</h1>
            {client.archivedAt && <Badge tone="grey">Archived</Badge>}
          </div>
          <div className="flex gap-4 text-ink-2">
            {client.email && (
              <a href={`mailto:${client.email}`} className="flex items-center gap-1.5 hover:text-ink">
                <Mail className="size-3.5" />
                {client.email}
              </a>
            )}
            {client.phone && (
              <a href={`tel:${client.phone.replace(/[^+0-9]/g, "")}`} className="flex items-center gap-1.5 tabular hover:text-ink">
                <Phone className="size-3.5" />
                {client.phone}
              </a>
            )}
            {client.phone && <WhatsAppLink phone={client.phone} text={`Hi ${client.name.split(" ")[0]}, `} />}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,720px)_300px] items-start gap-4">
          <ClientForm
            clientId={client.id}
            initial={{ name: client.name, email: client.email, phone: client.phone, address: client.address, source: client.source, notes: client.notes }}
            canEdit={canManage}
          />
          <div className="flex flex-col gap-4">
            <Panel className="flex flex-col gap-3 p-5">
              <div className="flex items-center justify-between">
                <SectionHeading title="Quotes" />
                {canQuote && !client.archivedAt && (
                  <Button variant="secondary" asChild>
                    <Link href={`/app/quotes/new?client=${client.id}`}>
                      <Plus />
                      New quote
                    </Link>
                  </Button>
                )}
              </div>
              {clientQuotes.length === 0 ? (
                <p className="text-ink-2">No quotes yet.</p>
              ) : canQuote ? (
                <ul className="flex flex-col">
                  {clientQuotes.map((q) => (
                    <li key={q.id} className="border-t border-hairline first:border-0">
                      <Link href={`/app/quotes/${q.id}`} className="flex items-center gap-2 py-2 hover:text-ink">
                        <span className="font-mono text-[11.5px] text-subtle">{quoteRef(q.number)}</span>
                        <span className="min-w-0 flex-1 truncate">{q.title}</span>
                        <span className="tabular text-ink-2">{formatGBP(q.total, 0)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-ink-2">
                  {quoteCount} {quoteCount === 1 ? "quote" : "quotes"}.
                </p>
              )}
              <div className="flex items-center justify-between gap-2">
                <p className="text-[12px] text-subtle">Added {dateFormat.format(client.createdAt)}</p>
                {canManage && (
                  <a href={`/app/clients/${client.id}/export`} download className="flex items-center gap-1 text-[12px] text-ink-2 hover:text-ink" title="Everything held about this client, for a data request (UK GDPR)">
                    <Download className="size-3.5" />
                    Export data
                  </a>
                )}
              </div>
            </Panel>
            {canQuote && (
              <PortalLinkPanel
                clientId={client.id}
                clientName={client.name}
                canReset={canManage}
                security={{ on: found.portalSignIn && emailConfigured(), hasEmail: Boolean(client.email), devices: found.portalDevices }}
              />
            )}
            {canManage && (
              <ArchivePanel
                noun="client"
                name={client.name}
                archived={client.archivedAt !== null}
                hint={
                  quoteCount === 0
                    ? "Archiving hides a client from the list and keeps their history. Only clients without quotes can be deleted."
                    : "Archiving hides a client from the list and keeps their history. Clients with quotes can't be deleted."
                }
                archivedHint="Hidden from the client list. Restore to use them on new quotes again."
                archive={archiveClient.bind(null, client.id)}
                remove={quoteCount === 0 ? removeClient.bind(null, client.id) : undefined}
              />
            )}
          </div>
        </div>
      </div>
    </LiveAppShell>
  );
}
