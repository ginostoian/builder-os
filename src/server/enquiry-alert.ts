/**
 * The email that tells a company's admins and office about a new website enquiry, from the enquiry form or
 * the cost estimator. Reply to it to answer the person directly.
 */
import "server-only";
import { withTenant } from "@/db";
import { enquiryAlertContext } from "@/db/pipeline";
import { emailConfigured, sendEmail } from "./email";
import { appOrigin } from "./origin";

export type EnquiryAlert = {
  name: string;
  email: string;
  phone?: string;
  postcode?: string;
  projectType?: string;
  budget?: string;
  description?: string;
  /** Where it came from, e.g. "your website cost estimator". */
  via?: string;
};

/** `leadId` is null when the company's plan doesn't include the pipeline: the email is all they get. */
export async function alertNewEnquiry(orgId: string, leadId: string | null, d: EnquiryAlert): Promise<void> {
  if (!emailConfigured()) return;
  const ctx = await withTenant(orgId, (tx) => enquiryAlertContext(tx, orgId));
  if (ctx.to.length === 0) return;
  const subject = `New enquiry: ${d.name}${d.projectType ? `, ${d.projectType.toLowerCase()}` : ""}`;
  const origin = await appOrigin();
  await sendEmail({
    to: ctx.to,
    replyTo: d.email,
    subject,
    fromName: "Builder OS",
    content: {
      company: { name: ctx.company, brandColour: ctx.brandColour },
      preheader: d.description?.slice(0, 120) ?? subject,
      heading: `New enquiry from ${d.name}`,
      paragraphs: [
        d.description ? `“${d.description.slice(0, 1_500)}”` : "No details given.",
        "Call them back while they're still looking: the first to reply usually wins the job. Reply to this email to answer them directly.",
      ],
      details: [
        ["Email", d.email],
        ...(d.phone ? ([["Phone", d.phone]] as [string, string][]) : []),
        ...(d.postcode ? ([["Postcode", d.postcode.toUpperCase()]] as [string, string][]) : []),
        ...(d.projectType ? ([["Work", d.projectType]] as [string, string][]) : []),
        ...(d.budget ? ([[d.via ? "Estimate shown" : "Budget", d.budget]] as [string, string][]) : []),
        ...(d.via ? ([["Came from", d.via]] as [string, string][]) : []),
      ],
      ...(leadId ? { button: { label: "Open the lead", href: `${origin}/app/pipeline/${leadId}` } } : {}),
      footer: leadId
        ? "You're getting this because you're an admin or in the office, and your website enquiries are on."
        : "You're getting this because you're an admin or in the office. On the Pro plan, enquiries also land in your sales pipeline as leads, with follow-ups.",
    },
  });
}
