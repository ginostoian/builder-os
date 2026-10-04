/**
 * The ⌘K search: a few of the best matches of each kind, only kinds the person may see. Names and
 * addresses match anywhere in the text; "Q-12", "INV 7", "PO-0003" or a bare number match by number.
 */
import "server-only";
import { and, desc, eq, ilike, isNull, or, sql, type AnyColumn } from "drizzle-orm";
import { poRef } from "@/core/costs";
import { invoiceRef } from "@/core/payment-plan";
import { quoteRef } from "@/core/quote";
import { can, type Role } from "@/core/roles";
import type { Tx } from "./index";
import { clients, invoices, leads, projects, purchaseOrders, quotes, workers } from "./schema";

export type SearchHit = { kind: SearchKind; id: string; title: string; detail: string | null; href: string };
export type SearchKind = "client" | "quote" | "project" | "lead" | "invoice" | "person" | "order";

const PER_KIND = 5;

/** An address (stored as JSON) matches on its lines, town and postcode, not its key names. */
const addressLike = (col: AnyColumn, like: string) =>
  sql`concat_ws(' ', ${col}->>'line1', ${col}->>'line2', ${col}->>'town', ${col}->>'postcode') ilike ${like}`;

/** One line of an address for the results list. */
const oneLine = (a: { line1: string; town: string; postcode: string } | null) => (a ? `${a.line1}, ${a.postcode}` : null);

/** `%text%` for ILIKE, with the user's own % and _ taken literally. */
export const likePattern = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

/** The number in "Q-0012", "inv 7", "#12" or "12", with the prefix if one was typed. */
export function parseRef(q: string): { prefix: "q" | "inv" | "po" | null; n: number } | null {
  const m = /^(q|inv|po)?[\s#-]*0*(\d{1,7})$/i.exec(q.trim());
  if (!m) return null;
  return { prefix: (m[1]?.toLowerCase() as "q" | "inv" | "po" | undefined) ?? null, n: Number(m[2]) };
}

export async function search(tx: Tx, orgId: string, role: Role, raw: string): Promise<SearchHit[]> {
  const q = raw.trim().slice(0, 100);
  if (q.length < 2 && !parseRef(q)) return [];
  const like = likePattern(q);
  const ref = parseRef(q);
  const byNumber = (col: typeof quotes.number | typeof purchaseOrders.number, prefix: "q" | "inv" | "po") => (ref && (ref.prefix === null || ref.prefix === prefix) ? eq(col, ref.n) : undefined);
  const hits: SearchHit[] = [];

  if (can(role, "clients.view")) {
    const rows = await tx
      .select({ id: clients.id, name: clients.name, email: clients.email, address: clients.address })
      .from(clients)
      .where(and(eq(clients.orgId, orgId), isNull(clients.archivedAt), or(ilike(clients.name, like), ilike(clients.email, like), ilike(clients.phone, like), addressLike(clients.address, like))))
      .orderBy(clients.name)
      .limit(PER_KIND);
    for (const r of rows) hits.push({ kind: "client", id: r.id, title: r.name, detail: r.email ?? oneLine(r.address), href: `/app/clients/${r.id}` });
  }

  if (can(role, "quotes.edit")) {
    const rows = await tx
      .select({ id: quotes.id, number: quotes.number, title: quotes.title, client: clients.name })
      .from(quotes)
      .innerJoin(clients, and(eq(clients.orgId, quotes.orgId), eq(clients.id, quotes.clientId)))
      .where(and(eq(quotes.orgId, orgId), or(ilike(quotes.title, like), addressLike(quotes.siteAddress, like), ilike(clients.name, like), byNumber(quotes.number, "q"))))
      .orderBy(desc(quotes.number))
      .limit(PER_KIND);
    for (const r of rows) hits.push({ kind: "quote", id: r.id, title: `${quoteRef(r.number)} ${r.title}`, detail: r.client, href: `/app/quotes/${r.id}` });
  }

  if (can(role, "projects.view")) {
    const rows = await tx
      .select({ id: projects.id, name: projects.name, address: projects.siteAddress, client: clients.name })
      .from(projects)
      .innerJoin(clients, and(eq(clients.orgId, projects.orgId), eq(clients.id, projects.clientId)))
      .where(and(eq(projects.orgId, orgId), or(ilike(projects.name, like), addressLike(projects.siteAddress, like), ilike(clients.name, like))))
      .orderBy(desc(projects.startDate))
      .limit(PER_KIND);
    for (const r of rows) hits.push({ kind: "project", id: r.id, title: r.name, detail: [r.client, oneLine(r.address)].filter(Boolean).join(" · ") || null, href: `/app/projects/${r.id}` });
  }

  if (can(role, "leads.view")) {
    const rows = await tx
      .select({ id: leads.id, name: leads.name, projectType: leads.projectType, postcode: leads.postcode })
      .from(leads)
      .where(and(eq(leads.orgId, orgId), or(ilike(leads.name, like), ilike(leads.email, like), ilike(leads.phone, like), addressLike(leads.address, like), ilike(leads.postcode, like), ilike(leads.projectType, like))))
      .orderBy(desc(leads.stageChangedAt))
      .limit(PER_KIND);
    for (const r of rows) hits.push({ kind: "lead", id: r.id, title: r.name, detail: [r.projectType, r.postcode].filter(Boolean).join(" · ") || null, href: `/app/pipeline/${r.id}` });
  }

  if (can(role, "invoices.manage") && ref && ref.prefix !== "q" && ref.prefix !== "po") {
    const rows = await tx
      .select({ id: invoices.id, number: invoices.number, client: clients.name })
      .from(invoices)
      .innerJoin(clients, and(eq(clients.orgId, invoices.orgId), eq(clients.id, invoices.clientId)))
      .where(and(eq(invoices.orgId, orgId), eq(invoices.number, ref.n)))
      .limit(PER_KIND);
    for (const r of rows) hits.push({ kind: "invoice", id: r.id, title: invoiceRef(r.number), detail: r.client, href: `/app/invoices/${r.id}` });
  }

  if (can(role, "team.view")) {
    const rows = await tx
      .select({ id: workers.id, name: workers.name, trade: workers.trade })
      .from(workers)
      .where(and(eq(workers.orgId, orgId), isNull(workers.archivedAt), or(ilike(workers.name, like), ilike(workers.trade, like), ilike(workers.email, like), ilike(workers.phone, like))))
      .orderBy(workers.name)
      .limit(PER_KIND);
    for (const r of rows) hits.push({ kind: "person", id: r.id, title: r.name, detail: r.trade, href: `/app/team/${r.id}` });
  }

  if (can(role, "costs.view")) {
    const rows = await tx
      .select({ id: purchaseOrders.id, number: purchaseOrders.number, supplier: purchaseOrders.supplierName, project: projects.name })
      .from(purchaseOrders)
      .innerJoin(projects, and(eq(projects.orgId, purchaseOrders.orgId), eq(projects.id, purchaseOrders.projectId)))
      .where(and(eq(purchaseOrders.orgId, orgId), or(ilike(purchaseOrders.supplierName, like), byNumber(purchaseOrders.number, "po"))))
      .orderBy(desc(purchaseOrders.number))
      .limit(PER_KIND);
    for (const r of rows) hits.push({ kind: "order", id: r.id, title: `${poRef(r.number)} ${r.supplier}`, detail: r.project, href: `/app/purchases/orders/${r.id}` });
  }

  return hits;
}
