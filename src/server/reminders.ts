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
import { findOrgsWithDueInvoices, withTenant } from "@/db";
import { claimReminder, invoicesForReminders, type InvoiceSnapshot } from "@/db/invoices";
import { clientContact, ensurePortalToken, memberEmail } from "@/db/sending";
import { emailConfigured } from "./email";
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
