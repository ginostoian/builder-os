/**
 * Every email the app sends uses this one layout: the contractor's name and brand colour on top, a heading,
 * short paragraphs, an optional button and detail rows, and a plain-text version for clients that prefer it.
 * Inline styles and tables only, because that's what email clients render reliably. All text is escaped.
 */

export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export type EmailContent = {
  company: { name: string; brandColour?: string | null };
  /** Shown by inboxes next to the subject. */
  preheader: string;
  heading: string;
  paragraphs: string[];
  button?: { label: string; href: string };
  /** Label/value rows, e.g. amount and due date. */
  details?: [string, string][];
  /** Small print under everything. */
  footer?: string;
};

const SAFE_HEX = /^#[0-9a-fA-F]{6}$/;

export function renderEmail(c: EmailContent): { html: string; text: string } {
  const brand = c.company.brandColour && SAFE_HEX.test(c.company.brandColour) ? c.company.brandColour : "#10100F";
  const p = (s: string) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#33332F">${escapeHtml(s).replace(/\n/g, "<br>")}</p>`;
  const details = c.details?.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:6px 0 18px;border-collapse:collapse">${c.details
        .map(
          ([k, v]) =>
            `<tr><td style="padding:7px 0;border-top:1px solid #EEEDE9;font-size:14px;color:#6B6A64">${escapeHtml(k)}</td><td style="padding:7px 0;border-top:1px solid #EEEDE9;font-size:14px;color:#10100F;text-align:right;font-weight:600">${escapeHtml(v)}</td></tr>`,
        )
        .join("")}</table>`
    : "";
  const button = c.button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 22px"><tr><td style="border-radius:9px;background:#10100F"><a href="${escapeHtml(c.button.href)}" style="display:inline-block;padding:12px 20px;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none">${escapeHtml(c.button.label)}</a></td></tr></table>`
    : "";
  const html = `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(c.heading)}</title></head>
<body style="margin:0;padding:0;background:#F4F3EF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(c.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F3EF;padding:28px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border-radius:14px;overflow:hidden">
<tr><td style="height:4px;background:${brand}"></td></tr>
<tr><td style="padding:24px 28px 6px;font-size:14px;font-weight:600;color:#10100F">${escapeHtml(c.company.name)}</td></tr>
<tr><td style="padding:6px 28px 12px"><h1 style="margin:0 0 14px;font-size:21px;line-height:1.3;color:#10100F">${escapeHtml(c.heading)}</h1>${c.paragraphs.map(p).join("")}${details}${button}</td></tr>
</table>
<p style="max-width:560px;margin:14px auto 0;font-size:12px;line-height:1.5;color:#8A8983">${escapeHtml(c.footer ?? `Sent by ${c.company.name} using Builder OS.`)}</p>
</td></tr></table></body></html>`;

  const text = [
    c.company.name,
    "",
    c.heading,
    "",
    ...c.paragraphs.flatMap((s) => [s, ""]),
    ...(c.details?.length ? [...c.details.map(([k, v]) => `${k}: ${v}`), ""] : []),
    ...(c.button ? [`${c.button.label}: ${c.button.href}`, ""] : []),
    c.footer ?? `Sent by ${c.company.name} using Builder OS.`,
  ].join("\n");
  return { html, text };
}

/**
 * "Better Homes Studio <quotes@example.com>" from the configured sender, so clients see the contractor's
 * name while mail still comes from the verified address. Quotes and angle brackets are stripped from the name.
 */
export function fromWithName(configured: string, displayName: string): string {
  const address = configured.match(/<([^>]+)>/)?.[1] ?? configured.trim();
  const name = displayName.replace(/["<>\\\r\n]/g, "").trim().slice(0, 70);
  return name ? `"${name}" <${address}>` : address;
}
