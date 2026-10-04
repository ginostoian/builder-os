"use server";

import { after } from "next/server";
import { LEAD_SOURCE_LABEL } from "@/core/pipeline";
import { ukToday } from "@/core/payment-plan";
import { enquiryInput } from "@/core/schemas";
import { findEnquiryForm, withTenant } from "@/db";
import { and, eq } from "drizzle-orm";
import { postcodeCovered } from "@/core/surveys";
import { createLead, enquiryAlertContext, recentWebEnquiries } from "@/db/pipeline";
import { leads } from "@/db/schema";
import { getSurveySettings, openSlots } from "@/db/surveys";
import { planAllows } from "@/db/billing";
import { runCompanyAutomations } from "@/server/automations";
import { emailConfigured, sendEmail } from "@/server/email";
import { appOrigin } from "@/server/origin";

/** `booking`: the page where they can book a survey straight away, when the company takes bookings online. */
export type EnquiryResult = { ok: true; booking?: string } | { ok: false; message: string };

/** At most this many website enquiries per company in 10 minutes: enough for a busy day, not for a bot. */
const FLOOD_LIMIT = 20;

/**
 * A website enquiry. Bots are turned away quietly (a hidden field people never fill in, and a form sent
 * within 3 seconds of loading), so they can't tell what tripped them.
 */
export async function submitEnquiry(token: string, input: unknown): Promise<EnquiryResult> {
  const parsed = enquiryInput.safeParse(input);
  if (!parsed.success) {
    const field = String(parsed.error.issues[0]?.path[0] ?? "");
    const labels: Record<string, string> = { name: "Please enter your name.", email: "Please check your email address.", phone: "Please check your phone number.", postcode: "Please check your postcode." };
    return { ok: false, message: labels[field] ?? "Please check what you've entered." };
  }
  const d = parsed.data;
  if (d.website || (d.startedAt && Date.now() - d.startedAt < 3_000)) return { ok: true };
  const orgId = typeof token === "string" ? await findEnquiryForm(token) : null;
  if (!orgId) return { ok: false, message: "This form isn't taking enquiries at the moment." };
  const created = await withTenant(orgId, async (tx) => {
    // The web form feeds the pipeline (Pro).
    if (!(await planAllows(tx, orgId, "pipeline"))) return "closed" as const;
    if ((await recentWebEnquiries(tx, orgId, 10)) >= FLOOD_LIMIT) return null;
    const leadId = await createLead(
      tx,
      orgId,
      {
        name: d.name,
        email: d.email,
        phone: d.phone,
        postcode: d.postcode?.toUpperCase(),
        source: "website",
        sourceDetail: d.heardFrom && d.heardFrom !== "website" ? `Heard about you: ${LEAD_SOURCE_LABEL[d.heardFrom]}` : undefined,
        projectType: d.projectType,
        budget: d.budget,
        description: d.description,
      },
      { memberId: null, viaWebForm: true, today: ukToday() },
    );
    // Offer online booking straight away when there are times free and the postcode is one they cover.
    const settings = await getSurveySettings(tx, orgId);
    let booking: string | undefined;
    if (settings.enabled && postcodeCovered(d.postcode, settings.postcodes) && (await openSlots(tx, orgId, new Date())).slots.length > 0) {
      const [l] = await tx.select({ token: leads.unsubscribeToken }).from(leads).where(and(eq(leads.orgId, orgId), eq(leads.id, leadId)));
      booking = l ? `/book/${l.token}` : undefined;
    }
    return { leadId, booking };
  });
  if (created === "closed") return { ok: false, message: "This form isn't taking enquiries at the moment." };
  if (!created) return { ok: false, message: "We've had a lot of enquiries in the last few minutes. Please try again shortly, or give us a call." };
  after(async () => {
    await alertTeam(orgId, created.leadId, d).catch(() => undefined);
    await runCompanyAutomations(orgId).catch(() => undefined);
  });
  return { ok: true, booking: created.booking };
}

async function alertTeam(orgId: string, leadId: string, d: { name: string; email: string; phone?: string; postcode?: string; projectType?: string; budget?: string; description?: string }) {
  if (!emailConfigured()) return;
  const ctx = await withTenant(orgId, (tx) => enquiryAlertContext(tx, orgId));
  if (ctx.to.length === 0) return;
  const subject = `New enquiry: ${d.name}${d.projectType ? `, ${d.projectType.toLowerCase()}` : ""}`;
  await sendEmail({
    to: ctx.to,
    replyTo: d.email,
    subject,
    fromName: "Builder OS",
    content: {
      company: { name: ctx.company, brandColour: ctx.brandColour },
      preheader: d.description?.slice(0, 120) ?? subject,
      heading: `New enquiry from ${d.name}`,
      paragraphs: [d.description ? `“${d.description.slice(0, 1_500)}”` : "No details given.", "Call them back while they're still looking: the first to reply usually wins the job. Reply to this email to answer them directly."],
      details: [
        ["Email", d.email],
        ...(d.phone ? ([["Phone", d.phone]] as [string, string][]) : []),
        ...(d.postcode ? ([["Postcode", d.postcode.toUpperCase()]] as [string, string][]) : []),
        ...(d.projectType ? ([["Work", d.projectType]] as [string, string][]) : []),
        ...(d.budget ? ([["Budget", d.budget]] as [string, string][]) : []),
      ],
      button: { label: "Open the lead", href: `${await appOrigin()}/app/pipeline/${leadId}` },
      footer: "You're getting this because you're an admin or in the office, and your website enquiry form is on.",
    },
  });
}
