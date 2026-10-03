/**
 * The client's side of the portal. Every function takes the tenant transaction for the company that
 * `findPortalAccess` resolved from the token, plus that token's client, and only ever touches that client's
 * sent quotes. Clients see snapshots (what they were sent), never live drafts, costs or markups.
 */
import "server-only";
import { and, count, desc, eq, gt, inArray } from "drizzle-orm";
import { isExpired, type QuoteSnapshot } from "@/core/quote-snapshot";
import type { PortalCommentInput, PortalDecisionInput } from "@/core/schemas";
import type { Tx } from "./index";
import { clients, organizations, portalAccess, quoteComments, quoteDecisions, quoteEvents, quoteVersions, quotes } from "./schema";

export type PortalErrorReason = "not_found" | "not_open" | "expired" | "decided" | "unknown_line" | "too_many";

export class PortalError extends Error {
  constructor(readonly reason: PortalErrorReason) {
    super(reason);
  }
}

/** Comments a client can post on one quote per hour: plenty for a conversation, not a flood. */
export const MAX_CLIENT_COMMENTS_PER_HOUR = 20;
const VIEW_WINDOW_MS = 30 * 60_000;

/** The company and client a portal shows: name and branding only. */
export async function portalHeader(tx: Tx, orgId: string, clientId: string) {
  const [org] = await tx
    .select({ name: organizations.name, tradingName: organizations.tradingName, logoUrl: organizations.logoUrl, brandColour: organizations.brandColour })
    .from(organizations)
    .where(eq(organizations.id, orgId));
  const [client] = await tx.select({ name: clients.name }).from(clients).where(and(eq(clients.orgId, orgId), eq(clients.id, clientId)));
  return org && client ? { company: org, clientName: client.name } : undefined;
}

/** Every quote the client has been sent, newest first, with its latest version's total and status. */
export async function portalQuotes(tx: Tx, orgId: string, clientId: string) {
  const rows = await tx
    .selectDistinctOn([quotes.id], {
      id: quotes.id,
      number: quotes.number,
      title: quotes.title,
      status: quotes.status,
      versionNo: quoteVersions.versionNo,
      totalPence: quoteVersions.totalPence,
      sentAt: quoteVersions.sentAt,
    })
    .from(quotes)
    .innerJoin(quoteVersions, and(eq(quoteVersions.orgId, quotes.orgId), eq(quoteVersions.quoteId, quotes.id)))
    .where(and(eq(quotes.orgId, orgId), eq(quotes.clientId, clientId)))
    .orderBy(quotes.id, desc(quoteVersions.versionNo));
  return rows.sort((a, b) => b.number - a.number);
}

/** One sent quote for the client, by its number: the latest version, decision, and the conversation. */
export async function portalQuote(tx: Tx, orgId: string, clientId: string, number: number) {
  const [quote] = await tx
    .select({ id: quotes.id, status: quotes.status })
    .from(quotes)
    .where(and(eq(quotes.orgId, orgId), eq(quotes.clientId, clientId), eq(quotes.number, number)));
  if (!quote) return undefined;
  const [version] = await tx
    .select({ id: quoteVersions.id, versionNo: quoteVersions.versionNo, snapshot: quoteVersions.snapshot, contentHash: quoteVersions.contentHash, sentAt: quoteVersions.sentAt })
    .from(quoteVersions)
    .where(and(eq(quoteVersions.orgId, orgId), eq(quoteVersions.quoteId, quote.id)))
    .orderBy(desc(quoteVersions.versionNo))
    .limit(1);
  if (!version) return undefined; // never sent: invisible to the client
  const [decision] = await tx
    .select({ decision: quoteDecisions.decision, fullName: quoteDecisions.fullName, signature: quoteDecisions.signature, reason: quoteDecisions.reason, createdAt: quoteDecisions.createdAt, contentHash: quoteDecisions.contentHash })
    .from(quoteDecisions)
    .where(and(eq(quoteDecisions.orgId, orgId), eq(quoteDecisions.versionId, version.id)));
  const comments = await tx
    .select({ id: quoteComments.id, lineId: quoteComments.lineId, authorKind: quoteComments.authorKind, authorName: quoteComments.authorName, body: quoteComments.body, createdAt: quoteComments.createdAt })
    .from(quoteComments)
    .where(and(eq(quoteComments.orgId, orgId), eq(quoteComments.quoteId, quote.id)))
    .orderBy(quoteComments.createdAt);
  const snapshot = version.snapshot as QuoteSnapshot;
  return {
    quoteId: quote.id,
    // Being revised: the client still sees the last version, but can't accept it until the new one arrives.
    revising: quote.status === "draft",
    expired: isExpired(snapshot.quote.validUntil),
    version: { ...version, snapshot },
    decision: decision ?? null,
    comments,
  };
}

/** Find the client's quote and its latest version, or throw. */
async function openQuote(tx: Tx, orgId: string, clientId: string, number: number) {
  const found = await portalQuote(tx, orgId, clientId, number);
  if (!found) throw new PortalError("not_found");
  return found;
}

/**
 * Record that the client opened a quote. The first view moves "sent" to "viewed". Called from the page in
 * the browser (not on the server render), so link previews and email scanners don't count as opens.
 */
export async function recordView(tx: Tx, orgId: string, access: { accessId: string; clientId: string }, number: number) {
  const q = await openQuote(tx, orgId, access.clientId, number);
  // One open per quote per half hour: refreshing or switching tabs isn't another open.
  const [recent] = await tx
    .select({ n: count() })
    .from(quoteEvents)
    .where(and(eq(quoteEvents.orgId, orgId), eq(quoteEvents.quoteId, q.quoteId), eq(quoteEvents.kind, "viewed"), gt(quoteEvents.createdAt, new Date(Date.now() - VIEW_WINDOW_MS))));
  if ((recent?.n ?? 0) > 0) return false;
  await tx.insert(quoteEvents).values({ orgId, quoteId: q.quoteId, versionId: q.version.id, kind: "viewed", actor: "client" });
  await tx.update(quotes).set({ status: "viewed" }).where(and(eq(quotes.orgId, orgId), eq(quotes.id, q.quoteId), eq(quotes.status, "sent")));
  await tx.update(portalAccess).set({ lastViewedAt: new Date() }).where(and(eq(portalAccess.orgId, orgId), eq(portalAccess.id, access.accessId)));
  return true;
}

export async function addClientComment(tx: Tx, orgId: string, clientId: string, number: number, input: PortalCommentInput) {
  const q = await openQuote(tx, orgId, clientId, number);
  if (input.lineId && !q.version.snapshot.sections.some((s) => s.lines.some((l) => l.id === input.lineId))) throw new PortalError("unknown_line");
  const [recent] = await tx
    .select({ n: count() })
    .from(quoteComments)
    .where(and(eq(quoteComments.orgId, orgId), eq(quoteComments.quoteId, q.quoteId), eq(quoteComments.authorKind, "client"), gt(quoteComments.createdAt, new Date(Date.now() - 3_600_000))));
  if ((recent?.n ?? 0) >= MAX_CLIENT_COMMENTS_PER_HOUR) throw new PortalError("too_many");
  await tx.insert(quoteComments).values({ orgId, quoteId: q.quoteId, versionId: q.version.id, lineId: input.lineId ?? null, authorKind: "client", authorName: input.name, body: input.body });
  await tx.insert(quoteEvents).values({ orgId, quoteId: q.quoteId, versionId: q.version.id, kind: "commented", actor: "client" });
}

/**
 * Accept or decline the latest version. One decision per version (a unique key backs this up). Not while the
 * quote is being revised, after it expired, or once a decision is made.
 */
export async function decide(
  tx: Tx,
  orgId: string,
  clientId: string,
  number: number,
  input: PortalDecisionInput,
  evidence: { ip: string | null; userAgent: string | null },
) {
  const q = await openQuote(tx, orgId, clientId, number);
  if (q.decision) throw new PortalError("decided");
  if (q.revising) throw new PortalError("not_open");
  if (q.expired) throw new PortalError("expired");
  const accepted = input.decision === "accepted";
  const claimed = await tx
    .update(quotes)
    .set(accepted ? { status: "accepted", acceptedAt: new Date() } : { status: "declined" })
    .where(and(eq(quotes.orgId, orgId), eq(quotes.id, q.quoteId), inArray(quotes.status, ["sent", "viewed"])))
    .returning({ id: quotes.id });
  if (claimed.length === 0) throw new PortalError("not_open");
  await tx.insert(quoteDecisions).values({
    orgId,
    quoteId: q.quoteId,
    versionId: q.version.id,
    decision: input.decision,
    fullName: input.fullName,
    signature: accepted ? input.signature : null,
    reason: !accepted ? (input.reason ?? null) : null,
    contentHash: q.version.contentHash,
    ip: evidence.ip?.slice(0, 64) ?? null,
    userAgent: evidence.userAgent?.slice(0, 500) ?? null,
  });
  await tx.insert(quoteEvents).values({ orgId, quoteId: q.quoteId, versionId: q.version.id, kind: input.decision, actor: "client" });
}
