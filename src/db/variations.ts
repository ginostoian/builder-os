/**
 * Variations to accepted quotes, team side and client side. Runs in the tenant transaction like everything
 * else. A draft is edited freely; sending freezes a client-safe snapshot (with its hash, for the signature);
 * the client approves or rejects it in their portal. Migration 0009's trigger keeps sent ones unchanged.
 */
import "server-only";
import { and, asc, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { buildVariationSnapshot, variationTotals, type VariationLine, type VariationSnapshot } from "@/core/variation";
import { canonicalJson, type QuoteSnapshot } from "@/core/quote-snapshot";
import type { PortalDecisionInput, VariationSaveInput } from "@/core/schemas";
import type { Tx } from "./index";
import { clients, invoices, organizations, quoteDecisions, quoteVersions, quotes, variations } from "./schema";
import { sha256 } from "./sending";

export type VariationErrorReason = "not_found" | "not_accepted" | "not_editable" | "empty" | "not_open" | "decided";

export class VariationError extends Error {
  constructor(readonly reason: VariationErrorReason) {
    super(reason);
  }
}

/** The accepted version of a quote, or undefined. Variations only exist on accepted quotes. */
async function acceptedQuote(tx: Tx, orgId: string, quoteId: string) {
  const [q] = await tx
    .select({ id: quotes.id, number: quotes.number, title: quotes.title, clientId: quotes.clientId, snapshot: quoteVersions.snapshot })
    .from(quotes)
    .innerJoin(quoteDecisions, and(eq(quoteDecisions.orgId, quotes.orgId), eq(quoteDecisions.quoteId, quotes.id), eq(quoteDecisions.decision, "accepted")))
    .innerJoin(quoteVersions, and(eq(quoteVersions.orgId, quoteDecisions.orgId), eq(quoteVersions.id, quoteDecisions.versionId)))
    .where(and(eq(quotes.orgId, orgId), eq(quotes.id, quoteId), eq(quotes.status, "accepted")));
  return q ? { ...q, snapshot: q.snapshot as QuoteSnapshot } : undefined;
}

// ── Team side ────────────────────────────────────────────────────────────────

/** Start a draft variation on an accepted quote, numbered after the quote's last one. */
export async function createVariation(tx: Tx, orgId: string, input: { quoteId: string; memberId: string }): Promise<string> {
  const q = await acceptedQuote(tx, orgId, input.quoteId);
  if (!q) throw new VariationError("not_accepted");
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`variation-number:${input.quoteId}`}, 0))`);
  const [{ next }] = await tx
    .select({ next: sql<number>`coalesce(max(${variations.number}), 0) + 1`.mapWith(Number) })
    .from(variations)
    .where(and(eq(variations.orgId, orgId), eq(variations.quoteId, input.quoteId)));
  const [row] = await tx
    .insert(variations)
    .values({ orgId, quoteId: q.id, clientId: q.clientId, number: next, title: `Variation ${next}`, vatRateBps: q.snapshot.quote.vatRateBps, createdByMemberId: input.memberId })
    .returning({ id: variations.id });
  return row.id;
}

/** One variation with its quote, client and invoice, for the team. */
export async function getVariation(tx: Tx, orgId: string, variationId: string) {
  const [row] = await tx
    .select({
      variation: variations,
      quoteNumber: quotes.number,
      quoteTitle: quotes.title,
      quoteMarkupBps: quotes.markupBps,
      clientName: clients.name,
      clientEmail: clients.email,
      invoiceNumber: invoices.number,
      invoiceStatus: invoices.status,
    })
    .from(variations)
    .innerJoin(quotes, and(eq(quotes.orgId, variations.orgId), eq(quotes.id, variations.quoteId)))
    .innerJoin(clients, and(eq(clients.orgId, variations.orgId), eq(clients.id, variations.clientId)))
    .leftJoin(invoices, and(eq(invoices.orgId, variations.orgId), eq(invoices.id, variations.invoiceId)))
    .where(and(eq(variations.orgId, orgId), eq(variations.id, variationId)));
  if (!row) return undefined;
  const v = row.variation;
  return {
    ...row,
    variation: { ...v, snapshot: v.snapshot as VariationSnapshot | null },
    // Billed means on a live invoice: voiding the invoice frees the variation again.
    billed: v.invoiceId !== null && row.invoiceStatus !== "void",
  };
}

/** A quote's variations, oldest first, for the sent-quote screen. */
export async function quoteVariations(tx: Tx, orgId: string, quoteId: string) {
  const rows = await tx
    .select({
      id: variations.id,
      number: variations.number,
      title: variations.title,
      status: variations.status,
      totalPence: variations.totalPence,
      sentAt: variations.sentAt,
      decidedAt: variations.decidedAt,
      invoiceId: variations.invoiceId,
      invoiceNumber: invoices.number,
      invoiceStatus: invoices.status,
    })
    .from(variations)
    .leftJoin(invoices, and(eq(invoices.orgId, variations.orgId), eq(invoices.id, variations.invoiceId)))
    .where(and(eq(variations.orgId, orgId), eq(variations.quoteId, quoteId)))
    .orderBy(asc(variations.number));
  return rows.map((r) => ({ ...r, billed: r.invoiceId !== null && r.invoiceStatus !== "void" }));
}

/** Replace a draft's content. Totals are recalculated here, never taken from the browser. */
export async function saveVariation(tx: Tx, orgId: string, input: VariationSaveInput) {
  const [v] = await tx.select({ vatRateBps: variations.vatRateBps }).from(variations).where(and(eq(variations.orgId, orgId), eq(variations.id, input.variationId)));
  if (!v) throw new VariationError("not_found");
  const t = variationTotals(input.lines, v.vatRateBps);
  const rows = await tx
    .update(variations)
    .set({ title: input.title, reason: input.reason || null, lines: input.lines, netPence: t.net, vatPence: t.vat, totalPence: t.total })
    .where(and(eq(variations.orgId, orgId), eq(variations.id, input.variationId), eq(variations.status, "draft")))
    .returning({ id: variations.id });
  if (rows.length === 0) throw new VariationError("not_editable");
}

export async function deleteVariation(tx: Tx, orgId: string, variationId: string) {
  const rows = await tx
    .delete(variations)
    .where(and(eq(variations.orgId, orgId), eq(variations.id, variationId), eq(variations.status, "draft")))
    .returning({ quoteId: variations.quoteId });
  if (rows.length === 0) throw new VariationError("not_editable");
  return rows[0].quoteId;
}

/** Freeze a draft and send it: the client can then approve or reject it in their portal. */
export async function sendVariation(tx: Tx, orgId: string, input: { variationId: string; memberId: string }) {
  const found = await getVariation(tx, orgId, input.variationId);
  if (!found) throw new VariationError("not_found");
  const v = found.variation;
  if (v.status !== "draft") throw new VariationError("not_editable");
  if (v.lines.length === 0) throw new VariationError("empty");
  const [org] = await tx.select().from(organizations).where(eq(organizations.id, orgId));
  const snapshot = buildVariationSnapshot({
    number: v.number,
    title: v.title,
    reason: v.reason,
    company: { name: org.name, tradingName: org.tradingName, vatNumber: org.vatNumber, logoUrl: org.logoUrl, brandColour: org.brandColour },
    clientName: found.clientName,
    quote: { number: found.quoteNumber, title: found.quoteTitle },
    vatRateBps: v.vatRateBps,
    lines: v.lines,
  });
  const rows = await tx
    .update(variations)
    .set({
      status: "sent",
      snapshot,
      contentHash: sha256(canonicalJson(snapshot)),
      netPence: snapshot.totals.net,
      vatPence: snapshot.totals.vat,
      totalPence: snapshot.totals.total,
      sentAt: new Date(),
      sentByMemberId: input.memberId,
    })
    .where(and(eq(variations.orgId, orgId), eq(variations.id, v.id), eq(variations.status, "draft")))
    .returning({ id: variations.id });
  if (rows.length === 0) throw new VariationError("not_editable");
  return { snapshot, quoteId: v.quoteId, clientId: v.clientId, clientEmail: found.clientEmail, clientName: found.clientName };
}

/** Take back a sent variation the client hasn't decided on. It stays on record as withdrawn. */
export async function withdrawVariation(tx: Tx, orgId: string, variationId: string) {
  const rows = await tx
    .update(variations)
    .set({ status: "withdrawn" })
    .where(and(eq(variations.orgId, orgId), eq(variations.id, variationId), eq(variations.status, "sent")))
    .returning({ quoteId: variations.quoteId });
  if (rows.length === 0) throw new VariationError("not_open");
  return rows[0].quoteId;
}

/**
 * Start a new draft from a sent, rejected or withdrawn variation (to change and send again). A sent one
 * is withdrawn first, so the client never has two versions of the same change to approve.
 */
export async function reviseVariation(tx: Tx, orgId: string, variationId: string, memberId: string): Promise<string> {
  const found = await getVariation(tx, orgId, variationId);
  if (!found) throw new VariationError("not_found");
  const v = found.variation;
  if (v.status === "draft" || v.status === "approved") throw new VariationError("not_open");
  if (v.status === "sent") await withdrawVariation(tx, orgId, v.id);
  const id = await createVariation(tx, orgId, { quoteId: v.quoteId, memberId });
  const t = variationTotals(v.lines, v.vatRateBps);
  await tx
    .update(variations)
    .set({ title: v.title, reason: v.reason, lines: v.lines, netPence: t.net, vatPence: t.vat, totalPence: t.total })
    .where(and(eq(variations.orgId, orgId), eq(variations.id, id)));
  return id;
}

/** Approved variations on a quote that aren't on a live invoice yet. */
export async function billableVariations(tx: Tx, orgId: string, quoteId: string) {
  return tx
    .select({ id: variations.id, number: variations.number, title: variations.title, netPence: variations.netPence, vatPence: variations.vatPence, totalPence: variations.totalPence, snapshot: variations.snapshot })
    .from(variations)
    .leftJoin(invoices, and(eq(invoices.orgId, variations.orgId), eq(invoices.id, variations.invoiceId)))
    .where(and(eq(variations.orgId, orgId), eq(variations.quoteId, quoteId), eq(variations.status, "approved"), or(isNull(variations.invoiceId), eq(invoices.status, "void"))))
    .orderBy(asc(variations.number));
}

// ── Client side ──────────────────────────────────────────────────────────────

const CLIENT_VISIBLE = ["sent", "approved", "rejected"] as const;

/** The client's variations (not drafts or withdrawn ones), newest first. */
export async function portalVariations(tx: Tx, orgId: string, clientId: string) {
  return tx
    .select({ id: variations.id, number: variations.number, title: variations.title, status: variations.status, totalPence: variations.totalPence, sentAt: variations.sentAt, quoteNumber: quotes.number, quoteTitle: quotes.title })
    .from(variations)
    .innerJoin(quotes, and(eq(quotes.orgId, variations.orgId), eq(quotes.id, variations.quoteId)))
    .where(and(eq(variations.orgId, orgId), eq(variations.clientId, clientId), inArray(variations.status, [...CLIENT_VISIBLE])))
    .orderBy(desc(variations.sentAt));
}

/** One variation for the client, by quote number and variation number. */
export async function portalVariation(tx: Tx, orgId: string, clientId: string, quoteNumber: number, number: number) {
  const [row] = await tx
    .select({
      id: variations.id,
      quoteId: variations.quoteId,
      status: variations.status,
      snapshot: variations.snapshot,
      contentHash: variations.contentHash,
      sentAt: variations.sentAt,
      decidedAt: variations.decidedAt,
      decisionName: variations.decisionName,
      signature: variations.signature,
      decisionReason: variations.decisionReason,
    })
    .from(variations)
    .innerJoin(quotes, and(eq(quotes.orgId, variations.orgId), eq(quotes.id, variations.quoteId)))
    .where(and(eq(variations.orgId, orgId), eq(variations.clientId, clientId), eq(quotes.number, quoteNumber), eq(variations.number, number), inArray(variations.status, [...CLIENT_VISIBLE])));
  return row ? { ...row, snapshot: row.snapshot as VariationSnapshot, sentAt: row.sentAt! } : undefined;
}

/** The client approves (signed) or rejects a sent variation. Once only. */
export async function decideVariation(
  tx: Tx,
  orgId: string,
  clientId: string,
  ref: { quoteNumber: number; number: number },
  input: PortalDecisionInput,
  evidence: { ip: string | null; userAgent: string | null },
) {
  const v = await portalVariation(tx, orgId, clientId, ref.quoteNumber, ref.number);
  if (!v) throw new VariationError("not_found");
  if (v.status !== "sent") throw new VariationError("decided");
  const approved = input.decision === "accepted";
  const rows = await tx
    .update(variations)
    .set({
      status: approved ? "approved" : "rejected",
      decidedAt: new Date(),
      decisionName: input.fullName,
      signature: approved ? input.signature : null,
      decisionReason: approved ? null : (input.reason ?? null),
      decisionIp: evidence.ip?.slice(0, 64) ?? null,
      decisionUserAgent: evidence.userAgent?.slice(0, 500) ?? null,
    })
    .where(and(eq(variations.orgId, orgId), eq(variations.id, v.id), eq(variations.status, "sent")))
    .returning({ id: variations.id });
  if (rows.length === 0) throw new VariationError("decided");
  return { variationId: v.id, quoteId: v.quoteId, snapshot: v.snapshot };
}

export type { VariationLine };
