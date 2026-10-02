import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, Phone } from "lucide-react";
import { LiveAppShell } from "@/components/app/live-app-shell";
import { Panel } from "@/components/app/app-shell";
import { ClientDangerZone } from "@/components/app/clients/client-actions";
import { ClientForm } from "@/components/app/clients/client-form";
import { SectionHeading } from "@/components/app/form-fields";
import { Badge } from "@/components/ui/badge";
import { can } from "@/core/roles";
import { id as uuid } from "@/core/schemas";
import { countClientQuotes, getClient } from "@/db/clients";
import { requirePermission, withSession } from "@/auth/session";

export const metadata: Metadata = { title: "Client" };

const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" });

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePermission("clients.view");
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();

  const found = await withSession(session, async (tx) => {
    const client = await getClient(tx, session.orgId, id);
    return client && { client, quoteCount: await countClientQuotes(tx, session.orgId, id) };
  });
  if (!found) notFound();
  const { client, quoteCount } = found;
  const canManage = can(session.role, "clients.manage");

  return (
    <LiveAppShell active="crm" crumbs={["Clients", client.name]}>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto bg-surface-2 px-6 py-[18px]">
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
          </div>
        </div>

        <div className="grid grid-cols-[minmax(0,720px)_300px] items-start gap-4">
          <ClientForm
            clientId={client.id}
            initial={{ name: client.name, email: client.email, phone: client.phone, address: client.address, source: client.source, notes: client.notes }}
            canEdit={canManage}
          />
          <div className="flex flex-col gap-4">
            <Panel className="flex flex-col gap-3 p-5">
              <SectionHeading title="Quotes" />
              <p className="text-ink-2">
                {quoteCount === 0 ? "No quotes yet. Quotes will be listed here once the quote builder is live." : `${quoteCount} ${quoteCount === 1 ? "quote" : "quotes"}.`}
              </p>
              <p className="text-[12px] text-subtle">Added {dateFormat.format(client.createdAt)}</p>
            </Panel>
            {canManage && <ClientDangerZone clientId={client.id} name={client.name} archived={client.archivedAt !== null} quoteCount={quoteCount} />}
          </div>
        </div>
      </div>
    </LiveAppShell>
  );
}
