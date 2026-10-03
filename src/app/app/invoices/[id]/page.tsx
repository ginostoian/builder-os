import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LiveAppShell } from "@/components/app/live-app-shell";
import { InvoiceActions } from "@/components/app/invoices/invoice-actions";
import { INVOICE_STATE, shortDate } from "@/components/app/invoices/status";
import { InvoiceDocument } from "@/components/portal/invoice-document";
import { Badge } from "@/components/ui/badge";
import { invoiceState, ukToday, type ReminderKind } from "@/core/payment-plan";
import { id as uuid } from "@/core/schemas";
import { getInvoice, paymentSettings } from "@/db/invoices";
import { clientContact, currentPortalToken } from "@/db/sending";
import { requirePermission, withSession } from "@/auth/session";
import { emailConfigured } from "@/server/email";
import { appOrigin, portalInvoiceUrl } from "@/server/origin";

export const metadata: Metadata = { title: "Invoice" };

const REMINDER_TEXT: Record<ReminderKind, string> = {
  before: "Reminder: due in 3 days",
  due: "Reminder: due today",
  overdue_3: "Reminder: 3 days overdue",
  overdue_7: "Reminder: 7 days overdue",
};
const time = (d: Date) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }).format(d);

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePermission("invoices.manage");
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();
  const data = await withSession(session, async (tx) => {
    const invoice = await getInvoice(tx, session.orgId, id);
    if (!invoice) return undefined;
    return {
      invoice,
      client: await clientContact(tx, session.orgId, invoice.clientId),
      token: await currentPortalToken(tx, session.orgId, invoice.clientId),
      settings: await paymentSettings(tx, session.orgId),
    };
  });
  if (!data) notFound();
  const { invoice, client } = data;
  const state = INVOICE_STATE[invoiceState(invoice.status, invoice.dueDate, ukToday())];
  const link = data.token && invoice.status !== "void" ? portalInvoiceUrl(await appOrigin(), data.token, invoice.number) : null;

  return (
    <LiveAppShell active="invoices" crumbs={["Payments", invoice.snapshot.ref]}>
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col overflow-auto bg-surface-2">
          <div className="flex items-start gap-4 border-b border-hairline bg-white px-6 pt-[18px] pb-3.5 print:hidden">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-[12px] text-subtle">{invoice.snapshot.ref}</span>
                <h1 className="truncate text-[19px] font-semibold tracking-[-0.02em]">{invoice.snapshot.description}</h1>
                <Badge tone={state.tone}>{state.label}</Badge>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3.5 text-subtle">
                <Link href={`/app/clients/${invoice.clientId}`} className="hover:text-ink">
                  {client?.name ?? invoice.snapshot.client.name}
                </Link>
                {invoice.quoteId && (
                  <Link href={`/app/quotes/${invoice.quoteId}`} className="hover:text-ink">
                    From {invoice.snapshot.quote?.ref ?? "quote"}
                  </Link>
                )}
              </div>
            </div>
            <InvoiceActions invoiceId={invoice.id} status={invoice.status} link={link} canEmail={emailConfigured() && Boolean(client?.email)} sent={invoice.sentAt !== null} />
          </div>
          <div className="mx-auto w-full max-w-[760px] px-6 py-5">
            <p className="mb-3 text-[12.5px] text-subtle print:hidden">This is what {client?.name ?? "the client"} sees in their portal.</p>
            <InvoiceDocument invoice={invoice} />
          </div>
        </div>

        <aside className="flex w-[300px] flex-none flex-col gap-4 overflow-auto border-l border-hairline bg-white p-[18px] print:hidden">
          <div>
            <div className="mb-2 text-xs font-medium text-subtle">History</div>
            <ol className="flex flex-col gap-2 text-[12.5px]">
              <li className="flex justify-between gap-2">
                <span className="text-ink-2">Raised</span>
                <span className="text-subtle">{time(invoice.createdAt)}</span>
              </li>
              {invoice.sentAt && (
                <li className="flex justify-between gap-2">
                  <span className="text-ink-2">Emailed to the client</span>
                  <span className="text-subtle">{time(invoice.sentAt)}</span>
                </li>
              )}
              {invoice.reminders.map((r) => (
                <li key={r.kind} className="flex justify-between gap-2">
                  <span className="text-ink-2">{REMINDER_TEXT[r.kind as ReminderKind] ?? r.kind}</span>
                  <span className="text-subtle">{time(r.sentAt)}</span>
                </li>
              ))}
              {invoice.paidOn && (
                <li className="flex justify-between gap-2">
                  <span className="text-success">Paid{invoice.paidReference ? ` · ${invoice.paidReference}` : ""}</span>
                  <span className="text-subtle">{shortDate(invoice.paidOn)}</span>
                </li>
              )}
            </ol>
          </div>
          <div className="rounded-[10px] bg-surface px-3.5 py-3 text-[12.5px] text-ink-2">
            {invoice.status !== "issued"
              ? "No reminders: this invoice isn't waiting for payment."
              : !data.settings?.remindersEnabled
                ? "Automatic reminders are off. Turn them on in Settings → Payments."
                : !client?.email
                  ? `${client?.name ?? "This client"} has no email address, so no reminders can be sent.`
                  : !emailConfigured()
                    ? "Email isn't set up yet, so reminders can't be sent."
                    : `${client.name} gets an email 3 days before it's due, on the day, then 3 and 7 days late, until it's marked paid.`}
          </div>
        </aside>
      </div>
    </LiveAppShell>
  );
}
