/**
 * The daily payment-reminder run (plan: invoices and reminders). Finds companies with unpaid invoices due
 * within 3 days, then, per company inside its own tenant transaction, works out which reminder each invoice
 * is owed today (`reminderDue`) and emails it to the client.
 *
 * Each reminder is claimed in the database before the email goes out, so overlapping or repeated runs never
 * send the same one twice. The trade-off: if Resend refuses an email after the claim, that one reminder is
 * skipped rather than retried; the next one still goes out on schedule.
 */
import "server-only";
import { addDays, reminderDue, ukToday, type ReminderKind } from "@/core/payment-plan";
import { CERT_WARNING_DAYS } from "@/core/team";
import { findOrgsWithDueInvoices, findOrgsWithExpiringCertificates, withTenant } from "@/db";
import { claimReminder, invoicesForReminders, type InvoiceSnapshot } from "@/db/invoices";
import { clientContact, ensurePortalToken, memberEmail } from "@/db/sending";
import { certificateReminderContext, certificatesToRemind, markCertificatesReminded } from "@/db/team";
import { emailConfigured, sendEmail } from "./email";
import { emailInvoice } from "./invoice-mail";

type Claimed = { kind: ReminderKind; to: string; clientName: string; token: string; replyTo: string | null; invoice: { number: number; snapshot: InvoiceSnapshot; dueDate: string; totalPence: number } };

export type ReminderRun = { companies: number; sent: number; failed: number; skippedNoEmail: number };

export async function runReminders(origin: string, today = ukToday()): Promise<ReminderRun> {
  const run: ReminderRun = { companies: 0, sent: 0, failed: 0, skippedNoEmail: 0 };
  if (!emailConfigured()) return run;
  for (const orgId of await findOrgsWithDueInvoices(addDays(today, 3))) {
    run.companies++;
    let claimed: Claimed[];
    try {
      claimed = await withTenant(orgId, async (tx) => {
        const out: Claimed[] = [];
        for (const inv of await invoicesForReminders(tx, orgId, addDays(today, 3))) {
          const kind = reminderDue(today, inv.dueDate, inv.sent);
          if (!kind) continue;
          const client = await clientContact(tx, orgId, inv.clientId);
          if (!client?.email) {
            run.skippedNoEmail++;
            continue;
          }
          if (!(await claimReminder(tx, orgId, inv.id, kind))) continue;
          out.push({
            kind,
            to: client.email,
            clientName: client.name,
            token: await ensurePortalToken(tx, orgId, inv.clientId),
            replyTo: inv.createdByMemberId ? await memberEmail(tx, orgId, inv.createdByMemberId) : null,
            invoice: { number: inv.number, snapshot: inv.snapshot, dueDate: inv.dueDate, totalPence: inv.totalPence },
          });
        }
        return out;
      });
    } catch (error) {
      // One company's problem shouldn't stop everyone else's reminders.
      console.error("Reminder run failed for a company", error instanceof Error ? error.message : error);
      continue;
    }
    // Emails go out after the claims are committed.
    for (const c of claimed) {
      const result = await emailInvoice({ kind: c.kind, origin, token: c.token, to: c.to, replyTo: c.replyTo, invoice: { ...c.invoice, clientName: c.clientName } });
      if (result.ok) run.sent++;
      else run.failed++;
    }
  }
  return run;
}

const longDate = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));

export type CertificateRun = { companies: number; emails: number; certificates: number; failed: number };

/**
 * Certificates and cards (CSCS, Gas Safe, insurance) that expire within 30 days, or already have: one email
 * per company to its admins and office, once per certificate. A certificate is marked as reminded only after
 * the email goes out, so a failed send is tried again the next day. Changing the expiry date resets it.
 */
export async function runCertificateReminders(origin: string, today = ukToday()): Promise<CertificateRun> {
  const run: CertificateRun = { companies: 0, emails: 0, certificates: 0, failed: 0 };
  if (!emailConfigured()) return run;
  const until = addDays(today, CERT_WARNING_DAYS);
  for (const orgId of await findOrgsWithExpiringCertificates(until)) {
    run.companies++;
    try {
      const { certs, ctx } = await withTenant(orgId, async (tx) => ({ certs: await certificatesToRemind(tx, orgId, until), ctx: await certificateReminderContext(tx, orgId) }));
      if (certs.length === 0 || ctx.to.length === 0) continue;
      const expired = certs.filter((c) => c.expiresOn! < today).length;
      const subject = expired > 0 ? `${certs.length} team certificate${certs.length > 1 ? "s" : ""} expired or expiring` : `${certs.length} team certificate${certs.length > 1 ? "s" : ""} expiring soon`;
      const result = await sendEmail({
        to: ctx.to,
        subject,
        fromName: "Builder OS",
        content: {
          company: { name: ctx.company, brandColour: ctx.brandColour },
          preheader: subject,
          heading: "Certificates to renew",
          paragraphs: ["These certificates and cards have expired or expire in the next 30 days. Renew them before the person is back on site, then update the date in Builder OS."],
          details: certs.slice(0, 40).map((c) => [`${c.workerName}: ${c.name}`, `${c.expiresOn! < today ? "Expired" : "Expires"} ${longDate(c.expiresOn!)}`]),
          button: { label: "Open the team", href: `${origin}/app/team` },
          footer: "You're getting this because you're an admin or in the office in Builder OS. Each certificate is mentioned once.",
        },
      });
      if (!result.ok) {
        run.failed++;
        continue;
      }
      await withTenant(orgId, (tx) => markCertificatesReminded(tx, orgId, certs.slice(0, 40).map((c) => c.id)));
      run.emails++;
      run.certificates += Math.min(certs.length, 40);
    } catch (error) {
      console.error("Certificate reminders failed for a company", error instanceof Error ? error.message : error);
      run.failed++;
    }
  }
  return run;
}
