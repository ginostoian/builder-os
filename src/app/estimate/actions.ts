"use server";

import { after } from "next/server";
import { describeProject, describeRange, estimate, PROJECTS } from "@/core/estimator";
import { ukToday } from "@/core/payment-plan";
import { estimateEnquiryInput } from "@/core/schemas";
import { findEstimator, withTenant } from "@/db";
import { planAllows } from "@/db/billing";
import { getEstimator } from "@/db/estimator";
import { createLead, recentWebEnquiries } from "@/db/pipeline";
import { runCompanyAutomations } from "@/server/automations";
import { alertNewEnquiry } from "@/server/enquiry-alert";
import { allow, checkFormToken, looksLikeSpam, perIp, spendFormToken } from "@/server/rate-limit";

export type EstimateEnquiryResult = { ok: true } | { ok: false; message: string };

const FLOOD_LIMIT = 20;
const CLOSED = "This estimator isn't taking enquiries at the moment.";

/**
 * "Get a proper quote" from a company's website cost estimator. The same protection as the enquiry form
 * (signed form token, a person's time to fill it in, a hidden field, rate limits), and the estimate is
 * worked out again here from the company's settings rather than trusted from the page. On the Pro plan it
 * becomes a lead in the pipeline; on every plan the company's admins and office get an email.
 */
export async function submitEstimateEnquiry(token: string, input: unknown): Promise<EstimateEnquiryResult> {
  const parsed = estimateEnquiryInput.safeParse(input);
  if (!parsed.success) {
    const field = String(parsed.error.issues[0]?.path[0] ?? "");
    const labels: Record<string, string> = { name: "Please enter your name.", email: "Please check your email address.", phone: "Please check your phone number.", postcode: "Please check your postcode." };
    return { ok: false, message: labels[field] ?? "Please check what you've entered." };
  }
  const d = parsed.data;
  if (typeof token !== "string") return { ok: false, message: CLOSED };
  const form = checkFormToken(`estimate:${token}`, d.formToken);
  if (form === "expired" || d.formToken === undefined) return { ok: false, message: "This page has been open a while. Please reload it and try again." };
  if (form !== "ok" || d.website || looksLikeSpam(d.name, d.message)) return { ok: true };
  if (!(await spendFormToken(`estimate:${token}`, d.formToken))) return { ok: true };
  const limits = [await perIp("enquiry_ip", 5, 600), await perIp("enquiry_ip_day", 30, 86_400), { bucket: "enquiry_email", subject: d.email, max: 3, windowSeconds: 3_600 }];
  if (!(await allow(...limits))) return { ok: false, message: "We've had several enquiries from you just now. Please try again later." };
  const orgId = await findEstimator(token);
  if (!orgId) return { ok: false, message: CLOSED };
  // Per company too: on plans without the pipeline there are no leads to count, only emails to send.
  if (!(await allow({ bucket: "estimate_org", subject: orgId, max: FLOOD_LIMIT, windowSeconds: 600 }))) return { ok: false, message: "We've had a lot of enquiries in the last few minutes. Please try again shortly." };

  const result = await withTenant(orgId, async (tx) => {
    const { settings } = await getEstimator(tx, orgId);
    if (!settings.types.includes(d.project.type)) return "closed" as const;
    const e = estimate(d.project, { region: settings.region, adjustPct: settings.adjustPct, vat: settings.vatRegistered, prices: settings.prices });
    if (!e) return "closed" as const;
    if ((await recentWebEnquiries(tx, orgId, 10)) >= FLOOD_LIMIT) return null;
    const project = describeProject(d.project);
    const range = describeRange(e);
    const description = [`Priced on your website cost estimator: ${project}. Estimate shown: ${range}.`, d.message].filter(Boolean).join("\n\n");
    const alert = { name: d.name, email: d.email, phone: d.phone, postcode: d.postcode?.toUpperCase(), projectType: PROJECTS[d.project.type].short, budget: range, description, via: "Your website cost estimator" };
    if (!(await planAllows(tx, orgId, "pipeline"))) return { leadId: null, alert };
    const leadId = await createLead(
      tx,
      orgId,
      { name: d.name, email: d.email, phone: d.phone, postcode: alert.postcode, source: "website", sourceDetail: "Cost estimator", projectType: alert.projectType, budget: range, description },
      { memberId: null, viaWebForm: true, today: ukToday() },
    );
    return { leadId, alert };
  });
  if (result === "closed") return { ok: false, message: CLOSED };
  if (!result) return { ok: false, message: "We've had a lot of enquiries in the last few minutes. Please try again shortly." };
  after(async () => {
    await alertNewEnquiry(orgId, result.leadId, result.alert).catch(() => undefined);
    if (result.leadId) await runCompanyAutomations(orgId).catch(() => undefined);
  });
  return { ok: true };
}
