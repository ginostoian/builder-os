/**
 * Emails to the team when a client acts on a quote. Best effort and never in the client's way: callers run
 * this with `after()`, so the portal responds first, and failures are logged rather than shown.
 */
import "server-only";
import { formatGBP } from "@/core/money";
import { withTenant } from "@/db";
import { notify } from "@/db/notifications";
import { alertContext } from "@/db/sending";
import type { NewNotification } from "@/core/notifications";
import { emailConfigured, sendEmail } from "./email";
import { appOrigin } from "./origin";

export type ClientActivity = { kind: "opened" } | { kind: "commented"; author: string; body: string } | { kind: "accepted"; signer: string } | { kind: "declined"; name: string; reason?: string };

export async function notifyTeam(orgId: string, quoteId: string, activity: ClientActivity): Promise<void> {
  try {
    const ctx = await withTenant(orgId, async (tx) => {
      const c = await alertContext(tx, orgId, quoteId);
      if (c) await notify(tx, orgId, c.memberIds, quoteNotification(activity, c, quoteId));
      return c;
    });
    if (!emailConfigured() || !ctx || ctx.to.length === 0) return;
    const link = `${await appOrigin()}/app/quotes/${quoteId}`;
    const what = `${ctx.quoteRef} · ${ctx.title}`;
    const copy = {
      opened: { subject: `${ctx.clientName} opened ${what}`, heading: `${ctx.clientName} opened your quote`, paragraphs: [`${ctx.clientName} is looking at ${what} (${formatGBP(ctx.total)} inc. VAT) right now. A good moment to follow up.`] },
      commented: { subject: `New comment on ${what}`, heading: `${activity.kind === "commented" ? activity.author : ctx.clientName} commented`, paragraphs: activity.kind === "commented" ? [`On ${what}:`, `“${activity.body.slice(0, 1_000)}”`, "Reply on the quote and they'll see it in their portal."] : [] },
      accepted: { subject: `Accepted: ${what}`, heading: `${ctx.clientName} accepted your quote`, paragraphs: [`${what} for ${formatGBP(ctx.total)} inc. VAT was accepted and signed by ${activity.kind === "accepted" ? activity.signer : ctx.clientName}.`, "The signature and its evidence are on the quote."] },
      declined: { subject: `Declined: ${what}`, heading: `${ctx.clientName} declined your quote`, paragraphs: [`${what} was declined by ${activity.kind === "declined" ? activity.name : ctx.clientName}.`, ...(activity.kind === "declined" && activity.reason ? [`Their reason: “${activity.reason.slice(0, 1_000)}”`] : []), "You can revise the quote and send an update."] },
    }[activity.kind];
    const result = await sendEmail({
      to: ctx.to,
      subject: copy.subject,
      fromName: "Builder OS",
      content: {
        company: { name: ctx.company, brandColour: ctx.brandColour },
        preheader: copy.subject,
        heading: copy.heading,
        paragraphs: copy.paragraphs,
        button: { label: "Open the quote", href: link },
        footer: "You're getting this because you sent this quote in Builder OS.",
      },
    });
    if (!result.ok) console.error("Team alert not sent", activity.kind);
  } catch (error) {
    console.error("Team alert failed", activity.kind, error instanceof Error ? error.message : "unknown");
  }
}

/** Tell the team a client approved or rejected a variation. Same recipients and rules as quote alerts. */
export async function notifyVariationDecision(
  orgId: string,
  quoteId: string,
  variationId: string,
  d: { approved: boolean; name: string; ref: string; title: string; total: number; reason?: string },
): Promise<void> {
  try {
    const what = `${d.ref} · ${d.title}`;
    const ctx = await withTenant(orgId, async (tx) => {
      const c = await alertContext(tx, orgId, quoteId);
      if (c)
        await notify(tx, orgId, c.memberIds, {
          kind: d.approved ? "variation_approved" : "variation_rejected",
          title: `${c.clientName} ${d.approved ? "approved" : "rejected"} variation ${what}`,
          body: d.approved ? `${formatGBP(d.total)} inc. VAT, ready to invoice.` : d.reason ? `“${d.reason}”` : null,
          href: `/app/variations/${variationId}`,
        });
      return c;
    });
    if (!emailConfigured() || !ctx || ctx.to.length === 0) return;
    const subject = `${d.approved ? "Approved" : "Rejected"}: variation ${what}`;
    const result = await sendEmail({
      to: ctx.to,
      subject,
      fromName: "Builder OS",
      content: {
        company: { name: ctx.company, brandColour: ctx.brandColour },
        preheader: subject,
        heading: `${ctx.clientName} ${d.approved ? "approved" : "rejected"} a variation`,
        paragraphs: d.approved
          ? [`${what} (${formatGBP(d.total)} inc. VAT) was approved and signed by ${d.name}.`, "Invoice it on its own, or add it to the next payment's invoice."]
          : [`${what} was rejected by ${d.name}.`, ...(d.reason ? [`Their reason: “${d.reason.slice(0, 1_000)}”`] : []), "You can revise it and send it again."],
        button: { label: "Open the variation", href: `${await appOrigin()}/app/variations/${variationId}` },
        footer: "You're getting this because you work on this quote in Builder OS.",
      },
    });
    if (!result.ok) console.error("Variation alert not sent");
  } catch (error) {
    console.error("Variation alert failed", error instanceof Error ? error.message : "unknown");
  }
}

/** The bell's version of a client's action on a quote. */
function quoteNotification(a: ClientActivity, c: { quoteRef: string; title: string; clientName: string; total: number }, quoteId: string): NewNotification {
  const what = `${c.quoteRef} · ${c.title}`;
  const href = `/app/quotes/${quoteId}`;
  switch (a.kind) {
    case "opened":
      return { kind: "quote_opened", title: `${c.clientName} opened ${what}`, body: "A good moment to follow up.", href };
    case "commented":
      return { kind: "quote_comment", title: `${a.author} commented on ${what}`, body: `“${a.body.slice(0, 300)}”`, href };
    case "accepted":
      return { kind: "quote_accepted", title: `${c.clientName} accepted ${what}`, body: `${formatGBP(c.total)} inc. VAT, signed by ${a.signer}.`, href };
    case "declined":
      return { kind: "quote_declined", title: `${c.clientName} declined ${what}`, body: a.reason ? `“${a.reason.slice(0, 300)}”` : null, href };
  }
}
