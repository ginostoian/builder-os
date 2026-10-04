"use server";

import { after } from "next/server";
import { LEAD_SOURCE_LABEL } from "@/core/pipeline";
import { ukToday } from "@/core/payment-plan";
import { enquiryInput } from "@/core/schemas";
import { findEnquiryForm, withTenant } from "@/db";
import { createLead, enquiryAlertContext, recentWebEnquiries } from "@/db/pipeline";
import { runCompanyAutomations } from "@/server/automations";
import { emailConfigured, sendEmail } from "@/server/email";
import { appOrigin } from "@/server/origin";

export type EnquiryResult = { ok: true } | { ok: false; message: string };

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
    if ((await recentWebEnquiries(tx, orgId, 10)) >= FLOOD_LIMIT) return null;
    return createLead(
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
  });
  if (!created) return { ok: false, message: "We've had a lot of enquiries in the last few minutes. Please try again shortly, or give us a call." };
  after(async () => {
    await alertTeam(orgId, created, d).catch(() => undefined);
    await runCompanyAutomations(orgId).catch(() => undefined);
  });
  return { ok: true };
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
