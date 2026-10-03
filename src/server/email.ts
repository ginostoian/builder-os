/**
 * Outgoing email through Resend's HTTP API (plan §2). Optional: without RESEND_API_KEY and EMAIL_FROM the
 * app still works, and the send dialog offers "copy link" and "open in your email app" instead.
 *
 * Every message is built with `renderEmail` (src/core/email-template.ts) and sent from the verified
 * EMAIL_FROM address, shown under the company's name.
 */
import "server-only";
import { fromWithName, renderEmail, type EmailContent } from "@/core/email-template";

export { escapeHtml } from "@/core/email-template";

export const emailConfigured = () => Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);

export type EmailResult = { ok: true } | { ok: false; message: string };

export async function sendEmail(mail: { to: string | string[]; replyTo?: string | null; subject: string; content: EmailContent; fromName?: string }): Promise<EmailResult> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) return { ok: false, message: "Email isn't set up yet." };
  const { html, text } = renderEmail(mail.content);
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: fromWithName(from, mail.fromName ?? mail.content.company.name),
        to: Array.isArray(mail.to) ? mail.to : [mail.to],
        reply_to: mail.replyTo ? [mail.replyTo] : undefined,
        subject: mail.subject,
        text,
        html,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) return { ok: true };
    // Log the status only: the body can echo addresses.
    console.error("Resend refused an email", res.status);
    return { ok: false, message: "The email couldn't be sent. Copy the link and send it yourself." };
  } catch {
    return { ok: false, message: "The email couldn't be sent. Copy the link and send it yourself." };
  }
}
