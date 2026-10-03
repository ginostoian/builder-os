"use server";

/**
 * Actions on the public client portal. There is no login: the token in the URL is the credential. Every
 * action resolves it to its company and client first, then works inside that tenant only.
 */
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { portalCommentInput, portalDecisionInput } from "@/core/schemas";
import { findPortalAccess, withTenant, type Tx } from "@/db";
import { PortalError, addClientComment, decide, recordView, type PortalErrorReason } from "@/db/portal";
import { notifyTeam } from "@/server/notify";
import { isBot, requestEvidence } from "@/server/origin";

export type PortalActionResult = { ok: true } | { ok: false; message: string };

const MESSAGES: Record<PortalErrorReason | "bad_link" | "invalid", string> = {
  bad_link: "This link no longer works. Ask for a new one.",
  not_found: "This quote isn't available any more.",
  not_open: "This quote is being updated. You'll be able to accept the new version when it arrives.",
  expired: "This quote has expired. Ask for an updated one.",
  decided: "You've already answered this quote.",
  unknown_line: "That line isn't on the quote any more. Refresh the page.",
  too_many: "That's a lot of comments in a short time. Please try again in a while.",
  invalid: "Check what you've typed and try again.",
};

const quoteNumber = (n: unknown) => (typeof n === "number" && Number.isInteger(n) && n > 0 && n < 1e9 ? n : null);

/** Called by the quote page in the browser once it's on screen. Bots and link previews never get here. */
export async function markViewed(token: string, number: number): Promise<void> {
  if (await isBot()) return;
  const n = quoteNumber(number);
  const access = typeof token === "string" ? await findPortalAccess(token) : null;
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
  return runIn(token, number, (tx, orgId, clientId, n) => addClientComment(tx, orgId, clientId, n, parsed.data), (orgId, quoteId) =>
    notifyTeam(orgId, quoteId, { kind: "commented", author: parsed.data.name, body: parsed.data.body }),
  );
}

export async function decideQuote(token: string, number: number, input: unknown): Promise<PortalActionResult> {
  const parsed = portalDecisionInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: MESSAGES.invalid };
  const evidence = await requestEvidence();
  const d = parsed.data;
  return runIn(token, number, (tx, orgId, clientId, n) => decide(tx, orgId, clientId, n, d, evidence), (orgId, quoteId) =>
    notifyTeam(orgId, quoteId, d.decision === "accepted" ? { kind: "accepted", signer: d.signature } : { kind: "declined", name: d.fullName, reason: d.reason }),
  );
}

/** Resolve the token, run `fn` in that company's tenant, then (after responding) `afterwards` with the quote id. */
async function runIn(
  token: string,
  number: unknown,
  fn: (tx: Tx, orgId: string, clientId: string, n: number) => Promise<string>,
  afterwards?: (orgId: string, quoteId: string) => Promise<void>,
): Promise<PortalActionResult> {
  const n = quoteNumber(number);
  const access = typeof token === "string" ? await findPortalAccess(token) : null;
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
