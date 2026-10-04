"use server";

/**
 * Actions on the public client portal. The token in the URL says whose portal it is; `requirePortal` also
 * checks this browser has signed in, when the company asks for that. Every action then works inside that
 * company's tenant only.
 */
import { allow, perIp } from "@/server/rate-limit";
import { revalidatePath } from "next/cache";
import { runCompanyAutomations } from "@/server/automations";
import { after } from "next/server";
import { portalCommentInput, portalDecisionInput } from "@/core/schemas";
import { withTenant, type Tx } from "@/db";
import { requirePortal } from "@/server/portal-auth";
import { and, eq } from "drizzle-orm";
import { clients } from "@/db/schema";
import { portalInvoice } from "@/db/invoices";
import { invoiceCheckout } from "@/server/stripe";
import { onlinePaymentsReady } from "@/server/payments";
import { PortalError, addClientComment, decide, recordView, type PortalErrorReason } from "@/db/portal";
import { VariationError, decideVariation } from "@/db/variations";
import { notifyTeam, notifyVariationDecision } from "@/server/notify";
import { appOrigin, isBot, portalInvoiceUrl, requestEvidence } from "@/server/origin";

export type PortalActionResult = { ok: true } | { ok: false; message: string };

const MESSAGES: Record<PortalErrorReason | "bad_link" | "invalid", string> = {
  bad_link: "This link no longer works, or you've been signed out. Reload the page.",
  not_found: "This quote isn't available any more.",
  not_open: "This quote is being updated. You'll be able to accept the new version when it arrives.",
  expired: "This quote has expired. Ask for an updated one.",
  decided: "You've already answered this quote.",
  unknown_line: "That line isn't on the quote any more. Refresh the page.",
  too_many: "That's a lot of comments in a short time. Please try again in a while.",
  invalid: "Check what you've typed and try again.",
};

const BUSY = "That's a lot of requests in a short time. Please wait a few minutes and try again.";

const quoteNumber = (n: unknown) => (typeof n === "number" && Number.isInteger(n) && n > 0 && n < 1e9 ? n : null);

/** Called by the quote page in the browser once it's on screen. Bots and link previews never get here. */
export async function markViewed(token: string, number: number): Promise<void> {
  if (await isBot()) return;
  const n = quoteNumber(number);
  const access = typeof token === "string" ? await requirePortal(token) : null;
  if (!access || n === null) return;
  const viewed = await withTenant(access.orgId, (tx) => recordView(tx, access.orgId, access, n)).catch((error: unknown) => {
    if (!(error instanceof PortalError)) throw error;
    return false as const;
  });
  // Tell the team the first time the client opens each version, not on every visit.
  if (viewed && viewed.first) after(() => notifyTeam(access.orgId, viewed.quoteId, { kind: "opened" }));
}

export async function postComment(token: string, number: number, input: unknown): Promise<PortalActionResult> {
  const parsed = portalCommentInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Write your name and a comment (up to 2,000 characters)." };
  if (!(await allow(await perIp("portal_comment_ip", 30, 3_600)))) return { ok: false, message: BUSY };
  return runIn(token, number, (tx, orgId, clientId, n) => addClientComment(tx, orgId, clientId, n, parsed.data), (orgId, quoteId) =>
    notifyTeam(orgId, quoteId, { kind: "commented", author: parsed.data.name, body: parsed.data.body }),
  );
}

export async function decideQuote(token: string, number: number, input: unknown): Promise<PortalActionResult> {
  const parsed = portalDecisionInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: MESSAGES.invalid };
  if (!(await allow(await perIp("portal_decide_ip", 20, 3_600)))) return { ok: false, message: BUSY };
  const evidence = await requestEvidence();
  const d = parsed.data;
  return runIn(token, number, (tx, orgId, clientId, n) => decide(tx, orgId, clientId, n, d, evidence), async (orgId, quoteId) => {
    await notifyTeam(orgId, quoteId, d.decision === "accepted" ? { kind: "accepted", signer: d.signature } : { kind: "declined", name: d.fullName, reason: d.reason });
    // Won or lost: start any same-day automation for that stage (a welcome email, say).
    await runCompanyAutomations(orgId).catch(() => undefined);
  });
}

/** Resolve the token, run `fn` in that company's tenant, then (after responding) `afterwards` with the quote id. */
async function runIn(
  token: string,
  number: unknown,
  fn: (tx: Tx, orgId: string, clientId: string, n: number) => Promise<string>,
  afterwards?: (orgId: string, quoteId: string) => Promise<void>,
): Promise<PortalActionResult> {
  const n = quoteNumber(number);
  const access = typeof token === "string" ? await requirePortal(token) : null;
  if (!access || n === null) return { ok: false, message: MESSAGES.bad_link };
  try {
    const quoteId = await withTenant(access.orgId, (tx) => fn(tx, access.orgId, access.clientId, n));
    if (afterwards) after(() => afterwards(access.orgId, quoteId));
  } catch (error) {
    if (error instanceof PortalError) return { ok: false, message: MESSAGES[error.reason] };
    throw error;
  }
  revalidatePath(`/portal/${token}`, "layout");
  return { ok: true };
}

/** The client approves (signed) or rejects a variation. */
export async function decideVariationAction(token: string, quoteNumberArg: number, number: number, input: unknown): Promise<PortalActionResult> {
  const parsed = portalDecisionInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: MESSAGES.invalid };
  if (!(await allow(await perIp("portal_decide_ip", 20, 3_600)))) return { ok: false, message: BUSY };
  const q = quoteNumber(quoteNumberArg);
  const n = quoteNumber(number);
  const access = typeof token === "string" ? await requirePortal(token) : null;
  if (!access || q === null || n === null) return { ok: false, message: MESSAGES.bad_link };
  const evidence = await requestEvidence();
  const d = parsed.data;
  try {
    const r = await withTenant(access.orgId, (tx) => decideVariation(tx, access.orgId, access.clientId, { quoteNumber: q, number: n }, d, evidence));
    after(() =>
      notifyVariationDecision(access.orgId, r.quoteId, r.variationId, {
        approved: d.decision === "accepted",
        name: d.fullName,
        ref: r.snapshot.ref,
        title: r.snapshot.title,
        total: r.snapshot.totals.total,
        reason: d.decision === "declined" ? d.reason : undefined,
      }),
    );
  } catch (error) {
    if (error instanceof VariationError) return { ok: false, message: error.reason === "decided" ? "You've already answered this variation." : "This variation isn't available any more." };
    throw error;
  }
  revalidatePath(`/portal/${token}`, "layout");
  return { ok: true };
}

/**
 * Pay an invoice online: a Stripe Checkout page on the company's own account. Only for unpaid invoices of
 * this client, when the company takes online payments.
 */
export async function payInvoiceAction(token: string, number: number): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  if (!(await allow(await perIp("portal_pay_ip", 20, 600)))) return { ok: false, message: BUSY };
  const n = quoteNumber(number);
  const access = typeof token === "string" ? await requirePortal(token) : null;
  if (!access || n === null) return { ok: false, message: MESSAGES.bad_link };
  const found = await withTenant(access.orgId, async (tx) => {
    const invoice = await portalInvoice(tx, access.orgId, access.clientId, n);
    if (!invoice || invoice.status !== "issued") return null;
    const ready = await onlinePaymentsReady(tx, access.orgId);
    if (!ready) return null;
    const [client] = await tx.select({ email: clients.email }).from(clients).where(and(eq(clients.orgId, access.orgId), eq(clients.id, access.clientId)));
    return { invoice, accountId: ready, email: client?.email ?? null };
  });
  if (!found) return { ok: false, message: "This invoice can't be paid online. Please use the bank details." };
  const s = found.invoice.snapshot;
  const url = await invoiceCheckout({
    orgId: access.orgId,
    accountId: found.accountId,
    invoiceId: found.invoice.id,
    ref: s.ref,
    company: s.company.tradingName ?? s.company.name,
    totalPence: found.invoice.totalPence,
    email: found.email,
    returnUrl: portalInvoiceUrl(await appOrigin(), token, n),
  }).catch((error: unknown) => {
    console.error("Couldn't start an invoice payment", error instanceof Error ? error.message : error);
    return null;
  });
  return url ? { ok: true, url } : { ok: false, message: "Online payment isn't available right now. Please use the bank details." };
}
