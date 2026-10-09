"use server";

import { after } from "next/server";
import { LEAD_SOURCE_LABEL } from "@/core/pipeline";
import { ukToday } from "@/core/payment-plan";
import { enquiryInput } from "@/core/schemas";
import { findEnquiryForm, withTenant } from "@/db";
import { and, eq } from "drizzle-orm";
import { postcodeCovered } from "@/core/surveys";
import { createLead, recentWebEnquiries } from "@/db/pipeline";
import { leads } from "@/db/schema";
import { getSurveySettings, openSlots } from "@/db/surveys";
import { planAllows } from "@/db/billing";
import { runCompanyAutomations } from "@/server/automations";
import { alertNewEnquiry } from "@/server/enquiry-alert";
import { allow, checkFormToken, looksLikeSpam, perIp, spendFormToken } from "@/server/rate-limit";

/** `booking`: the page where they can book a survey straight away, when the company takes bookings online. */
export type EnquiryResult = { ok: true; booking?: string } | { ok: false; message: string };

/** At most this many website enquiries per company in 10 minutes: enough for a busy day, not for a bot. */
const FLOOD_LIMIT = 20;

/**
 * A website enquiry. Bots are turned away quietly, so they can't tell what tripped them: the form must
 * carry the signed time it was served and take a person's time to fill in, a hidden field must stay empty,
 * and the text mustn't be a list of links. People get rate limits per IP and per email address on top of
 * the company-wide flood limit.
 */
export async function submitEnquiry(token: string, input: unknown): Promise<EnquiryResult> {
  const parsed = enquiryInput.safeParse(input);
  if (!parsed.success) {
    const field = String(parsed.error.issues[0]?.path[0] ?? "");
    const labels: Record<string, string> = { name: "Please enter your name.", email: "Please check your email address.", phone: "Please check your phone number.", postcode: "Please check your postcode." };
    return { ok: false, message: labels[field] ?? "Please check what you've entered." };
  }
  const d = parsed.data;
  if (typeof token !== "string") return { ok: false, message: "This form isn't taking enquiries at the moment." };
  const form = checkFormToken(`enquiry:${token}`, d.formToken);
  if (form === "expired" || d.formToken === undefined) return { ok: false, message: "This page has been open a while. Please reload it and send your enquiry again." };
  // Bots: a forged or instant submission, the hidden field, or a message full of links. Told it worked.
  if (form !== "ok" || d.website || looksLikeSpam(d.name, d.description, d.projectType)) return { ok: true };
  // Each page load sends once: a bot can't reuse one genuine token all day.
  if (!(await spendFormToken(`enquiry:${token}`, d.formToken))) return { ok: true };
  const limits = [await perIp("enquiry_ip", 5, 600), await perIp("enquiry_ip_day", 30, 86_400), { bucket: "enquiry_email", subject: d.email, max: 3, windowSeconds: 3_600 }];
  if (!(await allow(...limits))) return { ok: false, message: "We've had several enquiries from you just now. Please try again later, or give us a call." };
  const orgId = await findEnquiryForm(token);
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
    await alertNewEnquiry(orgId, created.leadId, d).catch(() => undefined);
    await runCompanyAutomations(orgId).catch(() => undefined);
  });
  return { ok: true, booking: created.booking };
}
