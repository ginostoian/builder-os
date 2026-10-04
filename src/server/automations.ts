/**
 * Sending the company's automation emails, and one-off emails to a lead. Due steps are claimed inside the
 * tenant transaction first (see `claimDueEmails`), then sent; a failed send is logged on the lead and not
 * retried, like payment reminders.
 *
 * Runs from the daily cron (8am) for steps due that day, and straight after anything that can start a
 * same-day step (a new lead, a stage change, a quote sent or decided), so "reply at once" emails go at once.
 */
import "server-only";
import { fillMergeFields, firstName, visitWhen, type MergeValues } from "@/core/pipeline";
import { findOrgsWithDueAutomations, withTenant, type Tx } from "@/db";
import { claimDueEmails, enquiryAlertContext, logLeadEmail, mergeFacts, type DueEmail } from "@/db/pipeline";
import { ensurePortalToken } from "@/db/sending";
import { emailConfigured, sendEmail } from "./email";
import { getSurveySettings } from "@/db/surveys";
import { planAllows } from "@/db/billing";
import { appOrigin, bookingUrl, portalUrl } from "./origin";
import { addSignIn } from "./portal-auth";

export type AutomationRun = { companies: number; sent: number; failed: number };

export async function runAutomations(origin: string, now = new Date()): Promise<AutomationRun> {
  const run: AutomationRun = { companies: 0, sent: 0, failed: 0 };
  if (!emailConfigured()) return run;
  for (const orgId of await findOrgsWithDueAutomations(now)) {
    run.companies++;
    try {
      const r = await runCompanyAutomations(orgId, origin, now);
      run.sent += r.sent;
      run.failed += r.failed;
    } catch (error) {
      console.error("Automation run failed for a company", error instanceof Error ? error.message : error);
    }
  }
  return run;
}

/** Send one company's due automation emails now. Safe to call any time (after a change, from the cron). */
export async function runCompanyAutomations(orgId: string, origin?: string, now = new Date()): Promise<{ sent: number; failed: number }> {
  if (!emailConfigured()) return { sent: 0, failed: 0 };
  const base = origin ?? (await appOrigin());
  const prepared = await withTenant(orgId, async (tx) => {
    // Automations are a Pro feature: a company that's left Pro sends none (and claims none, so they wait).
    if (!(await planAllows(tx, orgId, "automations"))) return [];
    const due = await claimDueEmails(tx, orgId, now);
    if (due.length === 0) return [];
    const company = await enquiryAlertContext(tx, orgId);
    const out = [];
    for (const d of due) out.push({ d, ...(await mergeContext(tx, orgId, d, company.company, base)), company });
    return out;
  });
  let sent = 0;
  let failed = 0;
  for (const p of prepared) {
    const subject = fillMergeFields(p.d.step.subject, p.values).trim() || p.d.automationName;
    const body = fillMergeFields(p.d.step.body, p.values);
    const unsubscribe = `${base}/unsubscribe/${p.d.lead.unsubscribeToken}`;
    const result = await sendEmail({
      to: p.d.lead.email,
      replyTo: p.replyTo,
      subject,
      fromName: p.company.company,
      headers: { "List-Unsubscribe": `<${base}/api/unsubscribe/${p.d.lead.unsubscribeToken}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
      content: {
        company: { name: p.company.company, brandColour: p.company.brandColour },
        preheader: body.split("\n").find((l) => l.trim() && !/^hi\b/i.test(l.trim()))?.slice(0, 140) ?? subject,
        heading: "",
        paragraphs: toParagraphs(body),
        footer: `You're getting this because you asked ${p.company.company} about some work. Don't want these emails? Unsubscribe: ${unsubscribe}`,
      },
    });
    const label = `${p.d.automationName} (email ${p.d.stepNo} of ${p.d.stepCount}): ${subject}`;
    await withTenant(orgId, (tx) => logLeadEmail(tx, orgId, p.d.leadId, "automation_email", result.ok ? `Sent: ${label}\n\n${body}` : `Couldn't send: ${label}`, null));
    if (result.ok) sent++;
    else failed++;
  }
  return { sent, failed };
}

/** Blank lines split paragraphs; single line breaks stay inside one. */
export const toParagraphs = (body: string) =>
  body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

async function mergeContext(tx: Tx, orgId: string, d: DueEmail, company: string, origin: string): Promise<{ values: MergeValues; replyTo: string | null }> {
  const facts = await mergeFacts(tx, orgId, d.lead);
  return { values: await leadMergeValues(tx, orgId, d.lead, facts, company, origin), replyTo: facts.ownerEmail };
}

/** The merge fields for one lead: their name, the job, you, the visit, and their quote's link if sent. */
export async function leadMergeValues(
  tx: Tx,
  orgId: string,
  lead: { name: string; projectType: string | null; visitAt: Date | null; clientId: string | null; unsubscribeToken: string },
  facts: Awaited<ReturnType<typeof mergeFacts>>,
  company: string,
  origin: string,
): Promise<MergeValues> {
  let quoteLink: string | null = null;
  if (facts.quote && facts.quote.status !== "draft" && lead.clientId) {
    const token = await ensurePortalToken(tx, orgId, lead.clientId);
    quoteLink = await addSignIn(tx, orgId, token, portalUrl(origin, token, facts.quote.number));
  }
  return {
    first_name: firstName(lead.name),
    name: lead.name,
    project: (lead.projectType ?? "project").toLowerCase(),
    company,
    my_name: facts.ownerName ? firstName(facts.ownerName) : company,
    visit_date: lead.visitAt ? visitWhen(lead.visitAt) : null,
    quote_link: quoteLink,
    // Only when the company takes bookings online; the same link moves or cancels a booked visit.
    booking_link: (await getSurveySettings(tx, orgId)).enabled ? bookingUrl(origin, lead.unsubscribeToken) : null,
  };
}
