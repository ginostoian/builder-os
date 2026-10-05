/**
 * Data exports for UK GDPR: everything a company holds (for its admin), and everything about one client
 * (for a subject access request). Rows are read inside the company's tenant, so RLS keeps them to it.
 *
 * Credentials are never exported: portal sign-in codes and sessions, rate-limit counters and billing
 * history are left out, and any column holding a token, secret or hash is blanked.
 */
import "server-only";
import { eq, inArray, is, or, sql, type SQL } from "drizzle-orm";
import { PgTable, getTableConfig, type PgColumn } from "drizzle-orm/pg-core";
import type { Tx } from "./index";
import * as schema from "./schema";

/** Tables that hold credentials or platform data, not the company's records. */
const SKIP = new Set(["portal_codes", "portal_sessions", "rate_limits", "subscription_events"]);
const SECRET_COLUMN = /token|secret|hash/i;
const MAX_ROWS = 200_000;

export type ExportTable = { name: string; columns: string[]; rows: Record<string, unknown>[] };

type Exportable = { table: PgTable; name: string; columns: Record<string, PgColumn> };

function tables(): Exportable[] {
  const out: Exportable[] = [];
  for (const value of Object.values(schema)) {
    if (!is(value, PgTable)) continue;
    const config = getTableConfig(value);
    if (SKIP.has(config.name)) continue;
    const columns = Object.fromEntries(config.columns.map((c) => [c.name, c])) as Record<string, PgColumn>;
    out.push({ table: value, name: config.name, columns });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

async function read(tx: Tx, t: Exportable, where: SQL): Promise<ExportTable> {
  const rows = (await tx.select().from(t.table).where(where).limit(MAX_ROWS)) as Record<string, unknown>[];
  const names = Object.keys(t.columns);
  // Drizzle returns camelCase keys; map them back to the column names people will see.
  const byKey = new Map(Object.entries(t.table as unknown as Record<string, unknown>).filter(([, v]) => v && typeof v === "object" && "name" in (v as object)).map(([k, v]) => [k, (v as PgColumn).name]));
  return {
    name: t.name,
    columns: names,
    rows: rows.map((r) => {
      const o: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(r)) {
        const col = byKey.get(key) ?? key;
        o[col] = SECRET_COLUMN.test(col) && value !== null ? "[removed]" : value;
      }
      return o;
    }),
  };
}

/** Every table's rows for the company. */
export async function exportCompany(tx: Tx, orgId: string): Promise<ExportTable[]> {
  const out: ExportTable[] = [];
  for (const t of tables()) {
    const where = t.name === "organizations" ? eq(t.columns.id, orgId) : t.columns.org_id ? eq(t.columns.org_id, orgId) : null;
    if (!where) continue;
    out.push(await read(tx, t, where));
  }
  return out;
}

/**
 * Everything about one client: their record, quotes (and everything hanging off them), invoices,
 * variations, projects, portal activity, leads with their client link or email address, and survey
 * bookings. Empty tables are left out.
 */
export async function exportClient(tx: Tx, orgId: string, clientId: string): Promise<ExportTable[] | null> {
  const [client] = await tx.select({ id: schema.clients.id, email: schema.clients.email }).from(schema.clients).where(sql`${schema.clients.orgId} = ${orgId} and ${schema.clients.id} = ${clientId}`);
  if (!client) return null;
  const quoteIds = (await tx.select({ id: schema.quotes.id }).from(schema.quotes).where(sql`${schema.quotes.orgId} = ${orgId} and ${schema.quotes.clientId} = ${clientId}`)).map((q) => q.id);
  const leadIds = (
    await tx
      .select({ id: schema.leads.id })
      .from(schema.leads)
      .where(sql`${schema.leads.orgId} = ${orgId} and (${schema.leads.clientId} = ${clientId}${client.email ? sql` or lower(${schema.leads.email}) = lower(${client.email})` : sql``})`)
  ).map((l) => l.id);
  const projectIds = (await tx.select({ id: schema.projects.id }).from(schema.projects).where(sql`${schema.projects.orgId} = ${orgId} and ${schema.projects.clientId} = ${clientId}`)).map((p) => p.id);

  const out: ExportTable[] = [];
  for (const t of tables()) {
    if (!t.columns.org_id) continue;
    const conditions: SQL[] = [];
    if (t.name === "clients") conditions.push(eq(t.columns.id, clientId));
    if (t.columns.client_id) conditions.push(eq(t.columns.client_id, clientId));
    if (t.name === "quotes" && quoteIds.length) conditions.push(inArray(t.columns.id, quoteIds));
    if (t.columns.quote_id && quoteIds.length) conditions.push(inArray(t.columns.quote_id, quoteIds));
    if (t.name === "leads" && leadIds.length) conditions.push(inArray(t.columns.id, leadIds));
    if (t.columns.lead_id && leadIds.length) conditions.push(inArray(t.columns.lead_id, leadIds));
    if (t.name === "projects" && projectIds.length) conditions.push(inArray(t.columns.id, projectIds));
    if (t.columns.project_id && projectIds.length && /^project_(phases|tasks|diary|files)$/.test(t.name)) conditions.push(inArray(t.columns.project_id, projectIds));
    if (conditions.length === 0) continue;
    const table = await read(tx, t, sql`${eq(t.columns.org_id, orgId)} and (${or(...conditions)})`);
    if (table.rows.length) out.push(table);
  }
  return out;
}

// ── Files ────────────────────────────────────────────────────────────────────

const csvCell = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  let s = v instanceof Date ? v.toISOString() : typeof v === "object" ? JSON.stringify(v) : String(v);
  // Spreadsheet formula injection: a cell starting with = + - @ (or a tab/CR) would run as a formula.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
};

export function toCsv(t: ExportTable): string {
  return [t.columns.map(csvCell).join(","), ...t.rows.map((r) => t.columns.map((c) => csvCell(r[c])).join(","))].join("\r\n") + "\r\n";
}
