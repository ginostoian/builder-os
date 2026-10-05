"use server";

import { supportInput } from "@/core/schemas";
import { LEGAL } from "@/lib/content/legal";
import { emailConfigured, sendEmail } from "@/server/email";
import { allow, checkFormToken, formToken, looksLikeSpam, perIp, spendFormToken } from "@/server/rate-limit";

export type SupportResult = { ok: true } | { ok: false; message: string };

/**
 * A fresh form token for the marketing site's forms. The pages are static (served from the cache), so the
 * form asks for its token when it opens; it still has to wait a few seconds before it can be used.
 */
export async function supportFormToken(): Promise<string> {
  return formToken("support");
}

/**
 * A message from the support page, emailed to the support inbox with the sender as Reply-To. Bots are
 * turned away quietly (told it worked): no genuine form token, a token used before, the hidden field
 * filled in, or text full of links. Nothing is ever emailed to the address typed in, so the form can't be
 * used to send mail to other people.
 */
export async function sendSupportMessage(input: unknown): Promise<SupportResult> {
  const parsed = supportInput.safeParse(input);
  if (!parsed.success) {
    const field = String(parsed.error.issues[0]?.path[0] ?? "");
    const labels: Record<string, string> = { name: "Please enter your name.", email: "Please check your email address.", message: "Please tell us a little more (at least a sentence).", topic: "Please choose a topic." };
    return { ok: false, message: labels[field] ?? "Please check what you've entered." };
  }
  const d = parsed.data;
  const form = checkFormToken("support", d.formToken);
  if (form === "expired" || d.formToken === undefined) return { ok: false, message: "This page has been open a while. Please reload it and send your message again." };
  if (form !== "ok" || d.website || looksLikeSpam(d.name, d.message, d.company)) return { ok: true };
  if (!(await spendFormToken("support", d.formToken))) return { ok: true };
  const limits = [await perIp("support_ip", 3, 600), await perIp("support_ip_day", 10, 86_400), { bucket: "support_email", subject: d.email, max: 3, windowSeconds: 3_600 }];
  if (!(await allow(...limits))) return { ok: false, message: "You've sent us a few messages just now. We'll get back to you; if it's urgent, email us directly." };
  if (!emailConfigured()) return { ok: false, message: `Our contact form isn't working right now. Please email ${LEGAL.supportEmail}.` };
  const sent = await sendEmail({
    to: LEGAL.supportEmail,
    replyTo: d.email,
    subject: `Support: ${d.topic} (${d.name}${d.company ? `, ${d.company}` : ""})`,
    content: {
      company: { name: "Builder OS", brandColour: null },
      preheader: d.message.slice(0, 120),
      heading: d.topic,
      paragraphs: [d.message],
      details: [["From", `${d.name} <${d.email}>`], ...(d.company ? ([["Company", d.company]] as [string, string][]) : [])],
      footer: "Sent from the support page. Reply to this email to answer them.",
    },
  });
  return sent.ok ? { ok: true } : { ok: false, message: `That didn't send. Please email ${LEGAL.supportEmail} instead.` };
}
