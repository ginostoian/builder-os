/**
 * Sending quotes and the team's side of the client portal: freezing a version, portal links, revising,
 * replies, and the activity timeline. Runs inside the tenant transaction like every other query.
 */
import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, asc, count, desc, eq, inArray, isNull, max, sql } from "drizzle-orm";
import { DEFAULT_PLAN } from "@/core/payment-plan";
import { PlanError, buildSnapshot, canonicalJson, type QuoteSnapshot } from "@/core/quote-snapshot";
import { entitlement, planHas } from "@/core/plans";
import { billingFacts } from "./billing";
import type { Tx } from "./index";
import { leadQuoteSent } from "./pipeline";
import { QuoteError, getQuote } from "./quotes";
import { clients, members, organizations, portalAccess, quoteComments, quoteDecisions, quoteEvents, quoteVersions, quotes } from "./schema";

export const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");
const newToken = () => randomBytes(32).toString("base64url");

// ── Portal links ─────────────────────────────────────────────────────────────

/** The client's active portal token, creating one if they don't have one yet. */
export async function ensurePortalToken(tx: Tx, orgId: string, clientId: string): Promise<string> {
  const [active] = await tx
    .select({ token: portalAccess.token })
    .from(portalAccess)
    .where(and(eq(portalAccess.orgId, orgId), eq(portalAccess.clientId, clientId), isNull(portalAccess.revokedAt)));
  if (active) return active.token;
  const token = newToken();
  // A concurrent request may have created one first (unique partial index); then use theirs.
  const inserted = await tx.insert(portalAccess).values({ orgId, clientId, token }).onConflictDoNothing().returning({ token: portalAccess.token });
  if (inserted[0]) return inserted[0].token;
  return ensurePortalToken(tx, orgId, clientId);
}

/** The client's active token, if they have one, without creating it. */
export async function currentPortalToken(tx: Tx, orgId: string, clientId: string): Promise<string | null> {
  const [active] = await tx
    .select({ token: portalAccess.token })
    .from(portalAccess)
    .where(and(eq(portalAccess.orgId, orgId), eq(portalAccess.clientId, clientId), isNull(portalAccess.revokedAt)));
  return active?.token ?? null;
}

/** Revoke the client's link and issue a new one. The old link stops working at once. */
export async function rotatePortalToken(tx: Tx, orgId: string, clientId: string): Promise<string> {
  await tx
    .update(portalAccess)
    .set({ revokedAt: new Date() })
    .where(and(eq(portalAccess.orgId, orgId), eq(portalAccess.clientId, clientId), isNull(portalAccess.revokedAt)));
  return ensurePortalToken(tx, orgId, clientId);
}

// ── Sending ──────────────────────────────────────────────────────────────────

export type SendResult = { versionId: string; versionNo: number; token: string; snapshot: QuoteSnapshot; clientEmail: string | null };

/**
 * Freeze a draft into the next version and mark it sent. Claims the draft's version like an autosave, so a
 * send can't race an edit. Throws QuoteError for a stale version, a non-draft, or an empty quote.
 */
export async function sendQuote(tx: Tx, orgId: string, input: { quoteId: string; baseVersion: number; memberId: string }): Promise<SendResult> {
  const claimed = await tx
    .update(quotes)
    .set({ status: "sent", sentAt: new Date(), version: sql`${quotes.version} + 1` })
    .where(and(eq(quotes.orgId, orgId), eq(quotes.id, input.quoteId), eq(quotes.version, input.baseVersion), eq(quotes.status, "draft")))
    .returning({ id: quotes.id });
  if (claimed.length === 0) {
    const [found] = await tx.select({ status: quotes.status }).from(quotes).where(and(eq(quotes.orgId, orgId), eq(quotes.id, input.quoteId)));
    throw new QuoteError(!found ? "not_found" : found.status !== "draft" ? "not_editable" : "conflict");
  }
  const loaded = (await getQuote(tx, orgId, input.quoteId))!;
  if (!loaded.sections.some((s) => s.lines.length > 0)) throw new QuoteError("empty");

  const [found] = await tx
    .select({ name: organizations.name, tradingName: organizations.tradingName, vatNumber: organizations.vatNumber, logoUrl: organizations.logoUrl, brandColour: organizations.brandColour, terms: organizations.quoteTerms })
    .from(organizations)
    .where(eq(organizations.id, orgId));
  // Your own logo and colours on quotes are an Essentials feature; Free quotes go out in Builder OS's style.
  const branded = planHas(entitlement(await billingFacts(tx, orgId), new Date()).plan, "branding");
  const org = found && (branded ? found : { ...found, logoUrl: null, brandColour: null });
  const [{ last }] = await tx
    .select({ last: max(quoteVersions.versionNo) })
    .from(quoteVersions)
    .where(and(eq(quoteVersions.orgId, orgId), eq(quoteVersions.quoteId, input.quoteId)));
  const versionNo = (last ?? 0) + 1;
  const q = loaded.quote;
  let snapshot: QuoteSnapshot;
  try {
    snapshot = buildSnapshot({
    company: org,
    clientName: loaded.client?.name ?? "",
    quote: { number: q.number, title: q.title, siteAddress: q.siteAddress, validUntil: q.validUntil, vatRateBps: q.vatRateBps },
    versionNo,
    paymentPlan: q.paymentPlan?.length ? q.paymentPlan : DEFAULT_PLAN(randomUUID()),
    sections: loaded.sections,
    });
  } catch (error) {
    if (error instanceof PlanError) throw new QuoteError("bad_plan");
    throw error;
  }
  const [version] = await tx
    .insert(quoteVersions)
    .values({ orgId, quoteId: q.id, versionNo, snapshot, contentHash: sha256(canonicalJson(snapshot)), totalPence: snapshot.totals.total, sentByMemberId: input.memberId })
    .returning({ id: quoteVersions.id });
  await tx.insert(quoteEvents).values({ orgId, quoteId: q.id, versionId: version.id, kind: "sent", actor: "staff", memberId: input.memberId });
  const token = await ensurePortalToken(tx, orgId, q.clientId);
  await leadQuoteSent(tx, orgId, input.quoteId);
  return { versionId: version.id, versionNo, token, snapshot, clientEmail: loaded.client?.email ?? null };
}

/**
 * Reopen a sent quote for changes. The client keeps seeing the last version sent (and can't accept it while
 * it's being revised) until it's sent again. Accepted quotes are final.
 */
export async function reviseQuote(tx: Tx, orgId: string, quoteId: string, memberId: string): Promise<void> {
  const reopened = await tx
    .update(quotes)
    .set({ status: "draft", version: sql`${quotes.version} + 1` })
    .where(and(eq(quotes.orgId, orgId), eq(quotes.id, quoteId), inArray(quotes.status, ["sent", "viewed", "declined", "expired"])))
    .returning({ id: quotes.id });
  if (reopened.length === 0) {
    const [found] = await tx.select({ status: quotes.status }).from(quotes).where(and(eq(quotes.orgId, orgId), eq(quotes.id, quoteId)));
    throw new QuoteError(!found ? "not_found" : "not_editable");
  }
  await tx.insert(quoteEvents).values({ orgId, quoteId, kind: "revised", actor: "staff", memberId });
}

// ── The team's view of a sent quote ──────────────────────────────────────────

export async function latestVersion(tx: Tx, orgId: string, quoteId: string) {
  const [v] = await tx
    .select()
    .from(quoteVersions)
    .where(and(eq(quoteVersions.orgId, orgId), eq(quoteVersions.quoteId, quoteId)))
    .orderBy(desc(quoteVersions.versionNo))
    .limit(1);
  return v ? { ...v, snapshot: v.snapshot as QuoteSnapshot } : undefined;
}

/** Everything the team needs on a sent quote: versions, timeline, comments, decisions, views, link. */
export async function quoteActivity(tx: Tx, orgId: string, quoteId: string) {
  const versions = await tx
    .select({ id: quoteVersions.id, versionNo: quoteVersions.versionNo, sentAt: quoteVersions.sentAt, totalPence: quoteVersions.totalPence, contentHash: quoteVersions.contentHash })
    .from(quoteVersions)
    .where(and(eq(quoteVersions.orgId, orgId), eq(quoteVersions.quoteId, quoteId)))
    .orderBy(asc(quoteVersions.versionNo));
  const events = await tx
    .select({ id: quoteEvents.id, kind: quoteEvents.kind, actor: quoteEvents.actor, createdAt: quoteEvents.createdAt, versionId: quoteEvents.versionId, memberName: members.name })
    .from(quoteEvents)
    .leftJoin(members, and(eq(members.orgId, quoteEvents.orgId), eq(members.id, quoteEvents.memberId)))
    .where(and(eq(quoteEvents.orgId, orgId), eq(quoteEvents.quoteId, quoteId)))
    .orderBy(asc(quoteEvents.createdAt));
  const comments = await tx
    .select({ id: quoteComments.id, versionId: quoteComments.versionId, lineId: quoteComments.lineId, authorKind: quoteComments.authorKind, authorName: quoteComments.authorName, body: quoteComments.body, createdAt: quoteComments.createdAt })
    .from(quoteComments)
    .where(and(eq(quoteComments.orgId, orgId), eq(quoteComments.quoteId, quoteId)))
    .orderBy(asc(quoteComments.createdAt));
  const decisions = await tx
    .select({ versionId: quoteDecisions.versionId, decision: quoteDecisions.decision, fullName: quoteDecisions.fullName, signature: quoteDecisions.signature, reason: quoteDecisions.reason, ip: quoteDecisions.ip, userAgent: quoteDecisions.userAgent, contentHash: quoteDecisions.contentHash, createdAt: quoteDecisions.createdAt })
    .from(quoteDecisions)
    .where(and(eq(quoteDecisions.orgId, orgId), eq(quoteDecisions.quoteId, quoteId)));
  const views = events.filter((e) => e.kind === "viewed");
  return { versions, events, comments, decisions, viewCount: views.length, lastViewedAt: views.at(-1)?.createdAt ?? null };
}

/** View counts for a page of quotes, for the quotes list. */
export async function viewCounts(tx: Tx, orgId: string, quoteIds: string[]): Promise<Map<string, number>> {
  if (quoteIds.length === 0) return new Map();
  const rows = await tx
    .select({ quoteId: quoteEvents.quoteId, n: count() })
    .from(quoteEvents)
    .where(and(eq(quoteEvents.orgId, orgId), inArray(quoteEvents.quoteId, quoteIds), eq(quoteEvents.kind, "viewed")))
    .groupBy(quoteEvents.quoteId);
  return new Map(rows.map((r) => [r.quoteId, r.n]));
}

/**
 * A reply from the team on the latest sent version. Returns what's needed to email the client about it:
 * their current email and portal link (null `to` when they have no email or their link was revoked).
 */
export async function addStaffReply(tx: Tx, orgId: string, input: { quoteId: string; body: string; memberId: string; memberName: string }) {
  const version = await latestVersion(tx, orgId, input.quoteId);
  if (!version) throw new QuoteError("not_sent");
  await tx.insert(quoteComments).values({ orgId, quoteId: input.quoteId, versionId: version.id, authorKind: "staff", authorName: input.memberName, memberId: input.memberId, body: input.body });
  await tx.insert(quoteEvents).values({ orgId, quoteId: input.quoteId, versionId: version.id, kind: "replied", actor: "staff", memberId: input.memberId });
  const [q] = await tx.select({ clientId: quotes.clientId }).from(quotes).where(and(eq(quotes.orgId, orgId), eq(quotes.id, input.quoteId)));
  const [client] = q ? await tx.select({ name: clients.name, email: clients.email }).from(clients).where(and(eq(clients.orgId, orgId), eq(clients.id, q.clientId))) : [];
  const token = q ? await currentPortalToken(tx, orgId, q.clientId) : null;
  const s = version.snapshot;
  return {
    to: client?.email && token ? client.email : null,
    token,
    clientName: client?.name ?? s.client.name,
    number: s.quote.number,
    ref: s.quote.ref,
    title: s.quote.title,
    company: { name: s.company.tradingName ?? s.company.name, brandColour: s.company.brandColour },
  };
}

/** The client's email and name, for the send dialog. */
export async function clientContact(tx: Tx, orgId: string, clientId: string) {
  const [c] = await tx.select({ name: clients.name, email: clients.email }).from(clients).where(and(eq(clients.orgId, orgId), eq(clients.id, clientId)));
  return c;
}

/** A team member's email, used as Reply-To on quote emails so the client's reply reaches a person. */
export async function memberEmail(tx: Tx, orgId: string, memberId: string): Promise<string | null> {
  const [m] = await tx.select({ email: members.email }).from(members).where(and(eq(members.orgId, orgId), eq(members.id, memberId)));
  return m?.email ?? null;
}

/**
 * Who to tell when a client acts on a quote, and what to say: the person who sent the latest version, or
 * (if they have no email) the company's Admins. Empty `to` means nobody can be emailed.
 */
export async function alertContext(tx: Tx, orgId: string, quoteId: string) {
  const version = await latestVersion(tx, orgId, quoteId);
  if (!version) return undefined;
  const s = version.snapshot;
  let to: string[] = [];
  // Who hears about it, in the app and by email: whoever sent the quote, or the Admins if they've gone.
  let memberIds: string[] = [];
  if (version.sentByMemberId) {
    const [m] = await tx.select({ email: members.email, active: members.active }).from(members).where(and(eq(members.orgId, orgId), eq(members.id, version.sentByMemberId)));
    if (m?.active) memberIds = [version.sentByMemberId];
    if (m?.email && m.active) to = [m.email];
  }
  // Email falls back to the Admins too when the sender has no address; the bell stays with the sender.
  if (memberIds.length === 0 || to.length === 0) {
    const admins = await tx.select({ id: members.id, email: members.email }).from(members).where(and(eq(members.orgId, orgId), eq(members.role, "admin"), eq(members.active, true)));
    if (memberIds.length === 0) memberIds = admins.map((a) => a.id);
    to = admins.flatMap((a) => (a.email ? [a.email] : []));
  }
  return { to, memberIds, quoteRef: s.quote.ref, title: s.quote.title, clientName: s.client.name, total: s.totals.total, company: s.company.tradingName ?? s.company.name, brandColour: s.company.brandColour };
}
