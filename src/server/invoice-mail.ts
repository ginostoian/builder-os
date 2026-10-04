/** Sends an invoice email (new or a reminder) to the client, with a link to the invoice in their portal. */
import "server-only";
import { invoiceEmail } from "@/core/invoice-email";
import type { ReminderKind } from "@/core/payment-plan";
import type { InvoiceSnapshot } from "@/db/invoices";
import { sendEmail, type EmailResult } from "./email";
import { portalInvoiceUrl } from "./origin";
import { withSignIn } from "./portal-auth";
import { withTenant } from "@/db";
import { onlinePaymentsReady } from "./payments";

export async function emailInvoice(opts: {
  kind: "new" | ReminderKind;
  orgId: string;
  origin: string;
  token: string;
  to: string;
  replyTo?: string | null;
  signOff?: string;
  invoice: { number: number; snapshot: InvoiceSnapshot; dueDate: string; totalPence: number; clientName: string };
}): Promise<EmailResult> {
  const { invoice: inv } = opts;
  const s = inv.snapshot;
  const { subject, content } = invoiceEmail(
    opts.kind,
    {
      ref: s.ref,
      company: { name: s.company.name, tradingName: s.company.tradingName, brandColour: s.company.brandColour },
      clientName: inv.clientName,
      description: s.description,
      totalPence: inv.totalPence,
      dueDate: inv.dueDate,
      bank: s.bank,
      link: await withSignIn(opts.orgId, opts.token, portalInvoiceUrl(opts.origin, opts.token, inv.number)),
      payOnline: Boolean(await withTenant(opts.orgId, (tx) => onlinePaymentsReady(tx, opts.orgId)).catch(() => null)),
    },
    opts.signOff,
  );
  return sendEmail({ to: opts.to, replyTo: opts.replyTo, subject, content });
}
