/**
 * Survey emails to the client: confirmation (with a calendar invite) when a visit is booked or moved, a
 * note when it's cancelled, and a reminder the day before (from the daily cron). These are about a visit
 * they arranged, so they go even to leads who unsubscribed from marketing emails.
 */
import "server-only";
import { and, eq } from "drizzle-orm";
import { firstName } from "@/core/pipeline";
import { londonToUtc, slotLabels, surveyIcs } from "@/core/surveys";
import { addDays, ukToday } from "@/core/payment-plan";
import { findOrgsWithDueSurveyReminders, withTenant } from "@/db";
import { enquiryAlertContext, logLeadEmail } from "@/db/pipeline";
import { leads, members } from "@/db/schema";
import { bookingSequence, claimSurveyReminder, surveysToRemind, visitPlace } from "@/db/surveys";
import { emailConfigured, sendEmail } from "./email";
import { bookingUrl } from "./origin";

type Visit = { id: string; startsAt: Date; endsAt: Date; memberId: string | null };

/** Email the client about their visit. Logged on the lead either way; never throws. */
export async function emailSurveyChange(orgId: string, leadId: string, visit: Visit, kind: "booked" | "moved" | "cancelled", origin: string): Promise<boolean> {
  if (!emailConfigured()) return false;
  try {
    const ctx = await withTenant(orgId, async (tx) => {
      const [l] = await tx.select({ name: leads.name, email: leads.email, token: leads.unsubscribeToken, address: leads.address, postcode: leads.postcode }).from(leads).where(and(eq(leads.orgId, orgId), eq(leads.id, leadId)));
      if (!l?.email) return null;
      const [surveyor] = visit.memberId ? await tx.select({ name: members.name, email: members.email }).from(members).where(and(eq(members.orgId, orgId), eq(members.id, visit.memberId))) : [];
      return { lead: l, surveyor: surveyor ?? null, company: await enquiryAlertContext(tx, orgId), sequence: await bookingSequence(tx, orgId, leadId) };
    });
    if (!ctx) return false;
    const { lead, surveyor, company } = ctx;
    const when = slotLabels(visit.startsAt);
    const place = visitPlace(lead);
    const link = bookingUrl(origin, lead.token);
    const who = surveyor ? firstName(surveyor.name) : null;
    const subject =
      kind === "cancelled" ? `Your survey on ${when.day} is cancelled` : kind === "moved" ? `Your survey has moved to ${when.day}, ${when.time}` : `Your survey: ${when.day} at ${when.time}`;
    const paragraphs =
      kind === "cancelled"
        ? [`Hi ${firstName(lead.name)},`, `Your visit on ${when.day} at ${when.time} is cancelled. If you'd still like us to come, pick another time below, or just reply to this email.`]
        : [
            `Hi ${firstName(lead.name)},`,
            `${kind === "moved" ? "Your survey has moved. We'll now see you" : "Thanks for booking. We'll see you"} on ${when.day} at ${when.time}${who ? `: ${who} from ${company.company} will come` : ""}.`,
            "It's worth having any drawings, photos of things you like or a rough budget to hand, but don't worry if not. The calendar invite is attached.",
            "Need a different time? Use the button below to move or cancel it.",
          ];
    const ics = surveyIcs({
      uid: `${leadId}@builderos`,
      startsAt: visit.startsAt,
      endsAt: visit.endsAt,
      summary: `Survey with ${company.company}`,
      location: place,
      description: `Move or cancel: ${link}`,
      organizer: company.company,
      sequence: ctx.sequence + (kind === "cancelled" ? 1 : 0),
      cancelled: kind === "cancelled",
    });
    const result = await sendEmail({
      to: lead.email!,
      replyTo: surveyor?.email ?? null,
      subject,
      fromName: company.company,
      content: {
        company: { name: company.company, brandColour: company.brandColour },
        preheader: subject,
        heading: kind === "cancelled" ? "Survey cancelled" : kind === "moved" ? "Your survey has moved" : "Your survey is booked",
        paragraphs,
        details: kind === "cancelled" ? undefined : [["When", `${when.day}, ${when.time}`], ...(place ? ([["Where", place]] as [string, string][]) : []), ...(who ? ([["Who's coming", who]] as [string, string][]) : [])],
        button: { label: kind === "cancelled" ? "Book another time" : "Move or cancel", href: link },
      },
      attachments: [{ filename: kind === "cancelled" ? "cancelled.ics" : "survey.ics", content: ics, contentType: "text/calendar" }],
    });
    await withTenant(orgId, (tx) => logLeadEmail(tx, orgId, leadId, "email", result.ok ? `Sent: ${subject}` : `Couldn't send: ${subject}`, null));
    return result.ok;
  } catch (error) {
    console.error("Survey email failed", error instanceof Error ? error.message : error);
    return false;
  }
}

export type SurveyReminderRun = { companies: number; sent: number; failed: number };

/** The day before each visit: remind the client, with the link to move it. */
export async function runSurveyReminders(origin: string, today = ukToday()): Promise<SurveyReminderRun> {
  const run: SurveyReminderRun = { companies: 0, sent: 0, failed: 0 };
  if (!emailConfigured()) return run;
  const from = londonToUtc(addDays(today, 1), 0);
  const to = londonToUtc(addDays(today, 2), 0);
  for (const orgId of await findOrgsWithDueSurveyReminders(from, to)) {
    run.companies++;
    try {
      const { visits, company } = await withTenant(orgId, async (tx) => ({ visits: await surveysToRemind(tx, orgId, from, to), company: await enquiryAlertContext(tx, orgId) }));
      for (const v of visits) {
        if (!(await withTenant(orgId, (tx) => claimSurveyReminder(tx, orgId, v.id)))) continue;
        if (!v.email) continue;
        const when = slotLabels(v.startsAt);
        const place = visitPlace(v);
        const subject = `See you tomorrow at ${when.time}`;
        const result = await sendEmail({
          to: v.email,
          subject,
          fromName: company.company,
          content: {
            company: { name: company.company, brandColour: company.brandColour },
            preheader: `Your survey with ${company.company} is tomorrow at ${when.time}.`,
            heading: "Your survey is tomorrow",
            paragraphs: [`Hi ${firstName(v.name)},`, `Just a reminder that ${v.surveyor ? firstName(v.surveyor) : "we"} will see you tomorrow, ${when.day}, at ${when.time}. If that no longer works, you can move it below.`],
            details: [["When", `${when.day}, ${when.time}`], ...(place ? ([["Where", place]] as [string, string][]) : [])],
            button: { label: "Move or cancel", href: bookingUrl(origin, v.token) },
          },
        });
        await withTenant(orgId, (tx) => logLeadEmail(tx, orgId, v.leadId, "email", result.ok ? `Sent: ${subject}` : `Couldn't send: ${subject}`, null));
        if (result.ok) run.sent++;
        else run.failed++;
      }
    } catch (error) {
      console.error("Survey reminders failed for a company", error instanceof Error ? error.message : error);
      run.failed++;
    }
  }
  return run;
}
