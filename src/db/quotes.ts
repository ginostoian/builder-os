/**
 * Quote queries. Each takes the tenant transaction from `withTenant`/`withSession`; RLS is the security
 * boundary, and the `orgId` / `quoteId` filters below make sure an op can only touch rows of this quote.
 *
 * Autosave (plan §4): the builder sends header changes and grid ops against the version it last saw. A save
 * bumps the version first, so a stale or concurrent save matches no row and is rejected as a whole.
 * Totals are never stored: they're worked out from the lines with `quoteTotals` in src/core/quote.ts.
 */
import "server-only";
import { and, asc, count, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { likePattern } from "@/core/clients";
import { MAX_LINES_PER_QUOTE } from "@/core/limits";
import { placeAt, quoteTotals, type QuoteTotals } from "@/core/quote";
import type { NewQuoteInput, QuoteOp, QuoteSave } from "@/core/schemas";
import type { Tx } from "./index";
import { clients, organizations, quoteLines, quoteSections, quotes, serviceBundleItems, services } from "./schema";

export const QUOTES_PAGE_SIZE = 50;

export type QuoteErrorReason = "conflict" | "not_editable" | "not_found" | "unknown_client" | "unknown_section" | "unknown_line" | "unknown_service" | "too_many_lines";

/** A save that can't be applied. Nothing from it is written (the transaction rolls back). */
export class QuoteError extends Error {
  constructor(readonly reason: QuoteErrorReason) {
    super(reason);
  }
}

const PG_FOREIGN_KEY = "23503";
const PG_UNIQUE = "23505";
const pgCode = (e: unknown) => (e as { code?: string; cause?: { code?: string } }).code ?? (e as { cause?: { code?: string } }).cause?.code;

// ── Reading ──────────────────────────────────────────────────────────────────

type TotalsLine = { quoteId: string; qty: string; ratePence: number; markupBps: number };

/** Totals for several quotes, from their lines. */
async function totalsFor(tx: Tx, orgId: string, list: { id: string; vatRateBps: number }[]): Promise<Map<string, QuoteTotals>> {
  if (list.length === 0) return new Map();
  const lines: TotalsLine[] = await tx
    .select({ quoteId: quoteSections.quoteId, qty: quoteLines.qty, ratePence: quoteLines.ratePence, markupBps: quoteLines.markupBps })
    .from(quoteLines)
    .innerJoin(quoteSections, and(eq(quoteSections.orgId, quoteLines.orgId), eq(quoteSections.id, quoteLines.sectionId)))
    .where(and(eq(quoteLines.orgId, orgId), inArray(quoteSections.quoteId, list.map((q) => q.id))));
  const byQuote = new Map<string, TotalsLine[]>();
  for (const l of lines) byQuote.set(l.quoteId, [...(byQuote.get(l.quoteId) ?? []), l]);
  return new Map(
    list.map((q) => [
      q.id,
      quoteTotals(
        [{ id: q.id, name: "", lines: (byQuote.get(q.id) ?? []).map((l, i) => ({ id: String(i), name: "", unit: "", qty: Number(l.qty), rate: l.ratePence, markup: l.markupBps })) }],
        q.vatRateBps,
      ),
    ]),
  );
}

export type QuoteListOptions = { search?: string; clientId?: string; page?: number };

/** Quotes, newest number first, with client name and totals. */
export async function listQuotes(tx: Tx, orgId: string, { search, clientId, page = 1 }: QuoteListOptions = {}) {
  const term = search?.trim().slice(0, 100);
  const pattern = term ? likePattern(term) : undefined;
  const digits = term?.replace(/^q-?0*/i, "");
  const rows = await tx
    .select({
      id: quotes.id,
      number: quotes.number,
      title: quotes.title,
      status: quotes.status,
      vatRateBps: quotes.vatRateBps,
      updatedAt: quotes.updatedAt,
      clientId: clients.id,
      clientName: clients.name,
    })
    .from(quotes)
    .innerJoin(clients, and(eq(clients.orgId, quotes.orgId), eq(clients.id, quotes.clientId)))
    .where(
      and(
        eq(quotes.orgId, orgId),
        clientId ? eq(quotes.clientId, clientId) : undefined,
        pattern
          ? or(ilike(quotes.title, pattern), ilike(clients.name, pattern), digits && /^\d{1,9}$/.test(digits) ? eq(quotes.number, Number(digits)) : undefined)
          : undefined,
      ),
    )
    .orderBy(desc(quotes.number))
    .limit(QUOTES_PAGE_SIZE + 1)
    .offset((Math.max(1, Math.floor(page)) - 1) * QUOTES_PAGE_SIZE);
  const pageRows = rows.slice(0, QUOTES_PAGE_SIZE);
  const totals = await totalsFor(tx, orgId, pageRows);
  return { quotes: pageRows.map((q) => ({ ...q, total: totals.get(q.id)!.total })), hasMore: rows.length > QUOTES_PAGE_SIZE };
}

export async function countQuotes(tx: Tx, orgId: string): Promise<number> {
  const [row] = await tx.select({ n: count() }).from(quotes).where(eq(quotes.orgId, orgId));
  return row?.n ?? 0;
}

/** A whole quote for the builder: header, client, and sections with their lines in order. */
export async function getQuote(tx: Tx, orgId: string, quoteId: string) {
  const [quote] = await tx
    .select()
    .from(quotes)
    .where(and(eq(quotes.orgId, orgId), eq(quotes.id, quoteId)));
  if (!quote) return undefined;
  const [client] = await tx
    .select({ id: clients.id, name: clients.name, email: clients.email, phone: clients.phone, address: clients.address })
    .from(clients)
    .where(and(eq(clients.orgId, orgId), eq(clients.id, quote.clientId)));
  const sections = await tx
    .select({ id: quoteSections.id, name: quoteSections.name })
    .from(quoteSections)
    .where(and(eq(quoteSections.orgId, orgId), eq(quoteSections.quoteId, quoteId)))
    .orderBy(asc(quoteSections.position), asc(quoteSections.id));
  const lines =
    sections.length === 0
      ? []
      : await tx
          .select({
            id: quoteLines.id,
            sectionId: quoteLines.sectionId,
            serviceId: quoteLines.serviceId,
            name: quoteLines.name,
            qty: quoteLines.qty,
            unit: quoteLines.unit,
            ratePence: quoteLines.ratePence,
            markupBps: quoteLines.markupBps,
            note: quoteLines.note,
            noteVisible: quoteLines.noteVisible,
            kind: quoteLines.kind,
          })
          .from(quoteLines)
          .where(and(eq(quoteLines.orgId, orgId), inArray(quoteLines.sectionId, sections.map((s) => s.id))))
          .orderBy(asc(quoteLines.position), asc(quoteLines.id));
  return {
    quote,
    client,
    sections: sections.map((s) => ({
      ...s,
      lines: lines.filter((l) => l.sectionId === s.id).map(({ sectionId: _, qty, ...l }) => ({ ...l, qty: Number(qty) })),
    })),
  };
}

export type LoadedQuote = NonNullable<Awaited<ReturnType<typeof getQuote>>>;

/** The active library, with each bundle's items, for the builder's "add a line" search. */
export async function libraryForQuotes(tx: Tx, orgId: string) {
  const list = await tx
    .select({
      id: services.id,
      kind: services.kind,
      category: services.category,
      name: services.name,
      description: services.description,
      unit: services.unit,
      ratePence: services.ratePence,
      defaultMarkupBps: services.defaultMarkupBps,
      usageCount: services.usageCount,
    })
    .from(services)
    .where(and(eq(services.orgId, orgId), isNull(services.archivedAt)))
    .orderBy(desc(services.usageCount), asc(sql`lower(${services.name})`))
    .limit(5_000);
  const items = await tx
    .select({
      bundleId: serviceBundleItems.bundleId,
      serviceId: services.id,
      qty: serviceBundleItems.qty,
      name: services.name,
      unit: services.unit,
      ratePence: services.ratePence,
      defaultMarkupBps: services.defaultMarkupBps,
    })
    .from(serviceBundleItems)
    .innerJoin(services, and(eq(services.orgId, serviceBundleItems.orgId), eq(services.id, serviceBundleItems.serviceId)))
    .where(eq(serviceBundleItems.orgId, orgId))
    .orderBy(asc(sql`lower(${services.name})`));
  return list.map((s) => ({
    ...s,
    items: s.kind === "bundle" ? items.filter((i) => i.bundleId === s.id).map(({ bundleId: _, qty, ...i }) => ({ ...i, qty: Number(qty) })) : [],
  }));
}

export type LibraryEntry = Awaited<ReturnType<typeof libraryForQuotes>>[number];

// ── Creating and deleting ────────────────────────────────────────────────────

/**
 * Start a draft for an existing, unarchived client, numbered after the company's last quote, with the
 * company's default markup and VAT rate and one empty section.
 */
export async function createQuote(tx: Tx, orgId: string, input: NewQuoteInput): Promise<string> {
  const [client] = await tx
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.orgId, orgId), eq(clients.id, input.clientId), isNull(clients.archivedAt)));
  if (!client) throw new QuoteError("unknown_client");
  const [org] = await tx
    .select({ markup: organizations.defaultMarkupBps, vat: organizations.defaultVatRateBps })
    .from(organizations)
    .where(eq(organizations.id, orgId));
  // Serialize numbering per company: a transaction-scoped advisory lock keyed on the org.
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`quote-number:${orgId}`}, 0))`);
  const [{ next }] = await tx
    .select({ next: sql<number>`coalesce(max(${quotes.number}), 0) + 1`.mapWith(Number) })
    .from(quotes)
    .where(eq(quotes.orgId, orgId));
  const [quote] = await tx
    .insert(quotes)
    .values({ orgId, clientId: input.clientId, number: next, title: input.title, markupBps: org?.markup ?? 0, vatRateBps: org?.vat ?? 2000 })
    .returning({ id: quotes.id });
  await tx.insert(quoteSections).values({ orgId, quoteId: quote.id, position: 0, name: "Works" });
  return quote.id;
}

/** Delete a draft and everything in it. Sent quotes are records and can't be deleted. */
export async function deleteDraft(tx: Tx, orgId: string, quoteId: string): Promise<"deleted" | "not_found" | "not_draft"> {
  const [quote] = await tx
    .select({ status: quotes.status })
    .from(quotes)
    .where(and(eq(quotes.orgId, orgId), eq(quotes.id, quoteId)));
  if (!quote) return "not_found";
  if (quote.status !== "draft") return "not_draft";
  const serviceIds = await serviceIdsInQuote(tx, orgId, quoteId);
  await tx.delete(quotes).where(and(eq(quotes.orgId, orgId), eq(quotes.id, quoteId)));
  await refreshUsage(tx, orgId, serviceIds);
  return "deleted";
}

// ── Saving ───────────────────────────────────────────────────────────────────

/**
 * Apply one autosave: claim the next version, then the header and ops in order. Returns the new version.
 * Throws `QuoteError` (and writes nothing) for a stale version, a quote that isn't a draft, or an op that
 * names a section, line or service outside this quote.
 */
export async function saveQuote(tx: Tx, orgId: string, save: QuoteSave): Promise<number> {
  const claimed = await tx
    .update(quotes)
    .set({ version: sql`${quotes.version} + 1` })
    .where(and(eq(quotes.orgId, orgId), eq(quotes.id, save.quoteId), eq(quotes.version, save.baseVersion), eq(quotes.status, "draft")))
    .returning({ version: quotes.version });
  if (claimed.length === 0) {
    const [found] = await tx
      .select({ status: quotes.status })
      .from(quotes)
      .where(and(eq(quotes.orgId, orgId), eq(quotes.id, save.quoteId)));
    throw new QuoteError(!found ? "not_found" : found.status !== "draft" ? "not_editable" : "conflict");
  }

  const touched = new Set<string>();
  try {
    if (save.header) {
      const [client] = await tx
        .select({ id: clients.id })
        .from(clients)
        .where(and(eq(clients.orgId, orgId), eq(clients.id, save.header.clientId)));
      if (!client) throw new QuoteError("unknown_client");
      await tx
        .update(quotes)
        .set({
          clientId: save.header.clientId,
          title: save.header.title,
          siteAddress: save.header.siteAddress ?? null,
          validUntil: save.header.validUntil ?? null,
          markupBps: save.header.markupBps,
          vatRateBps: save.header.vatRateBps,
        })
        .where(and(eq(quotes.orgId, orgId), eq(quotes.id, save.quoteId)));
    }
    for (const op of save.ops) await applyOp(tx, orgId, save.quoteId, op, touched);
  } catch (error) {
    // A service id from another company (or a deleted one) fails the composite foreign key.
    if (pgCode(error) === PG_FOREIGN_KEY) throw new QuoteError("unknown_service");
    // A new section or line id that already exists: the same save sent twice. Ask the browser to reload.
    if (pgCode(error) === PG_UNIQUE) throw new QuoteError("conflict");
    throw error;
  }

  if (save.ops.some((o) => o.op === "addLine" || o.op === "addSection")) {
    const [{ n }] = await tx
      .select({ n: count() })
      .from(quoteLines)
      .innerJoin(quoteSections, and(eq(quoteSections.orgId, quoteLines.orgId), eq(quoteSections.id, quoteLines.sectionId)))
      .where(and(eq(quoteLines.orgId, orgId), eq(quoteSections.quoteId, save.quoteId)));
    if (n > MAX_LINES_PER_QUOTE) throw new QuoteError("too_many_lines");
  }
  await refreshUsage(tx, orgId, [...touched]);
  return claimed[0].version;
}

async function sectionOf(tx: Tx, orgId: string, quoteId: string, sectionId: string) {
  const [s] = await tx
    .select({ id: quoteSections.id })
    .from(quoteSections)
    .where(and(eq(quoteSections.orgId, orgId), eq(quoteSections.quoteId, quoteId), eq(quoteSections.id, sectionId)));
  if (!s) throw new QuoteError("unknown_section");
  return s.id;
}

async function lineOf(tx: Tx, orgId: string, quoteId: string, lineId: string) {
  const [l] = await tx
    .select({ id: quoteLines.id, sectionId: quoteLines.sectionId, serviceId: quoteLines.serviceId })
    .from(quoteLines)
    .innerJoin(quoteSections, and(eq(quoteSections.orgId, quoteLines.orgId), eq(quoteSections.id, quoteLines.sectionId)))
    .where(and(eq(quoteLines.orgId, orgId), eq(quoteSections.quoteId, quoteId), eq(quoteLines.id, lineId)));
  if (!l) throw new QuoteError("unknown_line");
  return l;
}

/** Write `ids` order as positions 0..n-1 in one statement. */
async function writeOrder(tx: Tx, orgId: string, table: typeof quoteLines | typeof quoteSections, ids: string[]) {
  if (ids.length === 0) return;
  const values = sql.join(
    ids.map((id, i) => sql`(${id}::uuid, ${i}::int)`),
    sql`, `,
  );
  await tx.execute(sql`update ${table} set position = v.pos from (values ${values}) as v(id, pos) where ${table.orgId} = ${orgId} and ${table.id} = v.id`);
}

async function sectionOrder(tx: Tx, orgId: string, quoteId: string) {
  const rows = await tx
    .select({ id: quoteSections.id })
    .from(quoteSections)
    .where(and(eq(quoteSections.orgId, orgId), eq(quoteSections.quoteId, quoteId)))
    .orderBy(asc(quoteSections.position), asc(quoteSections.id));
  return rows.map((r) => r.id);
}

async function lineOrder(tx: Tx, orgId: string, sectionId: string) {
  const rows = await tx
    .select({ id: quoteLines.id })
    .from(quoteLines)
    .where(and(eq(quoteLines.orgId, orgId), eq(quoteLines.sectionId, sectionId)))
    .orderBy(asc(quoteLines.position), asc(quoteLines.id));
  return rows.map((r) => r.id);
}

async function applyOp(tx: Tx, orgId: string, quoteId: string, op: QuoteOp, touched: Set<string>) {
  switch (op.op) {
    case "addSection": {
      const before = await sectionOrder(tx, orgId, quoteId);
      await tx.insert(quoteSections).values({ id: op.sectionId, orgId, quoteId, name: op.name, position: before.length });
      await writeOrder(tx, orgId, quoteSections, placeAt(before, op.sectionId, op.position));
      return;
    }
    case "renameSection": {
      await sectionOf(tx, orgId, quoteId, op.sectionId);
      await tx.update(quoteSections).set({ name: op.name }).where(and(eq(quoteSections.orgId, orgId), eq(quoteSections.id, op.sectionId)));
      return;
    }
    case "moveSection": {
      await sectionOf(tx, orgId, quoteId, op.sectionId);
      await writeOrder(tx, orgId, quoteSections, placeAt(await sectionOrder(tx, orgId, quoteId), op.sectionId, op.position));
      return;
    }
    case "removeSection": {
      await sectionOf(tx, orgId, quoteId, op.sectionId);
      const used = await tx
        .select({ serviceId: quoteLines.serviceId })
        .from(quoteLines)
        .where(and(eq(quoteLines.orgId, orgId), eq(quoteLines.sectionId, op.sectionId)));
      for (const u of used) if (u.serviceId) touched.add(u.serviceId);
      await tx.delete(quoteSections).where(and(eq(quoteSections.orgId, orgId), eq(quoteSections.id, op.sectionId)));
      await writeOrder(tx, orgId, quoteSections, await sectionOrder(tx, orgId, quoteId));
      return;
    }
    case "addLine": {
      await sectionOf(tx, orgId, quoteId, op.sectionId);
      const before = await lineOrder(tx, orgId, op.sectionId);
      const l = op.line;
      await tx.insert(quoteLines).values({
        id: op.lineId,
        orgId,
        sectionId: op.sectionId,
        position: before.length,
        serviceId: l.serviceId ?? null,
        name: l.name,
        qty: String(l.qty),
        unit: l.unit,
        ratePence: l.ratePence,
        markupBps: l.markupBps,
        note: l.note || null,
        noteVisible: l.noteVisible,
        kind: l.kind,
      });
      await writeOrder(tx, orgId, quoteLines, placeAt(before, op.lineId, op.position));
      if (l.serviceId) touched.add(l.serviceId);
      return;
    }
    case "updateLine": {
      await lineOf(tx, orgId, quoteId, op.lineId);
      const c = op.change;
      const set =
        c.field === "qty"
          ? { qty: String(c.value) }
          : c.field === "note"
            ? { note: c.value === "" ? null : c.value }
            : { [c.field]: c.value };
      await tx.update(quoteLines).set(set).where(and(eq(quoteLines.orgId, orgId), eq(quoteLines.id, op.lineId)));
      return;
    }
    case "moveLine": {
      const line = await lineOf(tx, orgId, quoteId, op.lineId);
      await sectionOf(tx, orgId, quoteId, op.sectionId);
      const target = await lineOrder(tx, orgId, op.sectionId);
      if (line.sectionId !== op.sectionId) {
        await tx.update(quoteLines).set({ sectionId: op.sectionId }).where(and(eq(quoteLines.orgId, orgId), eq(quoteLines.id, op.lineId)));
        await writeOrder(tx, orgId, quoteLines, await lineOrder(tx, orgId, line.sectionId));
      }
      await writeOrder(tx, orgId, quoteLines, placeAt(target, op.lineId, op.position));
      return;
    }
    case "removeLine": {
      const line = await lineOf(tx, orgId, quoteId, op.lineId);
      if (line.serviceId) touched.add(line.serviceId);
      await tx.delete(quoteLines).where(and(eq(quoteLines.orgId, orgId), eq(quoteLines.id, op.lineId)));
      await writeOrder(tx, orgId, quoteLines, await lineOrder(tx, orgId, line.sectionId));
      return;
    }
  }
}

async function serviceIdsInQuote(tx: Tx, orgId: string, quoteId: string): Promise<string[]> {
  const rows = await tx
    .selectDistinct({ serviceId: quoteLines.serviceId })
    .from(quoteLines)
    .innerJoin(quoteSections, and(eq(quoteSections.orgId, quoteLines.orgId), eq(quoteSections.id, quoteLines.sectionId)))
    .where(and(eq(quoteLines.orgId, orgId), eq(quoteSections.quoteId, quoteId)));
  return rows.flatMap((r) => (r.serviceId ? [r.serviceId] : []));
}

/** Recount "used in N quotes" for these services from the quotes themselves, so it can't drift. */
async function refreshUsage(tx: Tx, orgId: string, serviceIds: string[]) {
  if (serviceIds.length === 0) return;
  await tx
    .update(services)
    .set({
      usageCount: sql`(select count(distinct qs.quote_id)::int from ${quoteLines} l join ${quoteSections} qs on qs.org_id = l.org_id and qs.id = l.section_id where l.org_id = ${services.orgId} and l.service_id = ${services.id})`,
    })
    .where(and(eq(services.orgId, orgId), inArray(services.id, serviceIds)));
}
