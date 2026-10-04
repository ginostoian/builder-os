/**
 * The only way app code talks to the database. There is deliberately no exported `db`: every query runs
 * inside `withTenant`, which pins the transaction to one organization so Postgres RLS can enforce isolation.
 *
 * Server-only. Importing this from a Client Component fails the build.
 */
import "server-only";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { clerkOrgId, clerkUserId } from "@/core/clerk";
import { id, isoDate, portalToken } from "@/core/schemas";
import { databaseUrl } from "./env";
import * as schema from "./schema";

type Db = PostgresJsDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** Statement timeout inside tenant transactions, so one bad query can't hold a connection forever. */
const STATEMENT_TIMEOUT = "10s";

let client: postgres.Sql | undefined;
let db: Db | undefined;
let roleCheck: Promise<void> | undefined;

function getDb(): Db {
  if (!db) {
    client = postgres(databaseUrl(), {
      // Neon's pooled endpoint (PgBouncer, transaction mode) doesn't support named prepared statements.
      prepare: false,
      max: Number(process.env.DATABASE_POOL_MAX ?? 5),
      idle_timeout: 20,
      connect_timeout: 10,
      // Never log query parameters: they contain client names, addresses and prices.
      debug: false,
    });
    db = drizzle(client, { schema });
  }
  return db;
}

/**
 * Refuse to run if the connection role could see across tenants: a superuser, a BYPASSRLS role, or the
 * owner of a tenant table. Checked once per process. This catches a production DATABASE_URL that was set
 * to the owner connection string by mistake.
 */
async function assertRestrictedRole(database: Db): Promise<void> {
  const rows = await database.execute<{ superuser: boolean; bypassrls: boolean; owns_tables: boolean }>(sql`
    select r.rolsuper as superuser,
           r.rolbypassrls as bypassrls,
           exists (
             select 1 from pg_class c
             join pg_namespace ns on ns.oid = c.relnamespace
             where ns.nspname = 'public' and c.relkind = 'r' and pg_has_role(current_user, c.relowner, 'MEMBER')
           ) as owns_tables
    from pg_roles r where r.rolname = current_user`);
  const role = rows[0];
  if (!role || role.superuser || role.bypassrls || role.owns_tables) {
    throw new Error(
      "DATABASE_URL must use a login role in builderos_app (not a superuser, BYPASSRLS role or table owner). See docs/database.md.",
    );
  }
}

/**
 * Run `fn` in a transaction scoped to one organization. `orgId` must come from the authenticated session,
 * never from request input. Anything `fn` reads or writes outside that organization is invisible or rejected
 * by RLS. The setting is transaction-local, so it can't leak to the next request on a pooled connection.
 */
export async function withTenant<T>(orgId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const tenant = id.parse(orgId);
  const database = await checkedDb();
  return database.transaction(async (tx) => {
    await tx.execute(
      sql`select set_config('app.org_id', ${tenant}, true), set_config('statement_timeout', ${STATEMENT_TIMEOUT}, true)`,
    );
    return fn(tx);
  });
}

async function checkedDb(): Promise<Db> {
  const database = getDb();
  roleCheck ??= assertRestrictedRole(database).catch((error: unknown) => {
    roleCheck = undefined;
    throw error;
  });
  await roleCheck;
  return database;
}

/**
 * Our organization for a Clerk organization ID, across tenants. Used by the session (to pick the tenant)
 * and the Clerk webhook. Returns only the id and whether it was deleted: the lookup runs as
 * `builderos_lookup` (migration 0005), which can't read anything else.
 */
export async function findOrgByClerkId(clerkId: string): Promise<{ id: string; deleted: boolean } | null> {
  const key = clerkOrgId.parse(clerkId);
  const database = await checkedDb();
  const rows = await database.execute<{ id: string; deleted: boolean }>(sql`select id, deleted from app_org_for_clerk(${key})`);
  return rows[0] ? { id: rows[0].id, deleted: rows[0].deleted } : null;
}

/** Every organization a Clerk user has (or had) a member row in. Used to copy profile changes. */
export async function findOrgsForClerkUser(clerkId: string): Promise<string[]> {
  const key = clerkUserId.parse(clerkId);
  const database = await checkedDb();
  const rows = await database.execute<{ org_id: string }>(sql`select org_id from app_orgs_for_clerk_user(${key}) as org_id`);
  return rows.map((row) => row.org_id);
}

/**
 * The company and client an active portal token belongs to, or null. Public portal pages call this first,
 * then do everything else inside `withTenant` for that company.
 */
export async function findPortalAccess(token: string): Promise<{ accessId: string; orgId: string; clientId: string } | null> {
  const parsed = portalToken.safeParse(token);
  if (!parsed.success) return null;
  const database = await checkedDb();
  const rows = await database.execute<{ access_id: string; org_id: string; client_id: string }>(
    sql`select access_id, org_id, client_id from app_portal_lookup(${parsed.data})`,
  );
  return rows[0] ? { accessId: rows[0].access_id, orgId: rows[0].org_id, clientId: rows[0].client_id } : null;
}

/**
 * Companies with unpaid invoices due on or before `until` that have reminders switched on. The daily reminder
 * job calls this first, then works through each company inside `withTenant`.
 */
export async function findOrgsWithDueInvoices(until: string): Promise<string[]> {
  const day = isoDate.parse(until);
  const database = await checkedDb();
  const rows = await database.execute<{ org_id: string }>(sql`select org_id from app_orgs_with_due_invoices(${day}::date) as org_id`);
  return rows.map((row) => row.org_id);
}

/** Companies with current workers' certificates expiring by `until` that haven't been reminded about. */
export async function findOrgsWithExpiringCertificates(until: string): Promise<string[]> {
  const day = isoDate.parse(until);
  const database = await checkedDb();
  const rows = await database.execute<{ org_id: string }>(sql`select org_id from app_orgs_with_expiring_certificates(${day}::date) as org_id`);
  return rows.map((row) => row.org_id);
}

const lookupToken = z.string().regex(/^[A-Za-z0-9_-]{20,64}$/);

/** The company whose public enquiry form this token opens, or null (unknown, switched off, or deleted). */
export async function findEnquiryForm(token: string): Promise<string | null> {
  const parsed = lookupToken.safeParse(token);
  if (!parsed.success) return null;
  const database = await checkedDb();
  const rows = await database.execute<{ org_id: string }>(sql`select org_id from app_enquiry_form_lookup(${parsed.data}) as org_id`);
  return rows[0]?.org_id ?? null;
}

/** The company and lead an unsubscribe link belongs to, or null. */
export async function findLeadForUnsubscribe(token: string): Promise<{ orgId: string; leadId: string } | null> {
  const parsed = lookupToken.safeParse(token);
  if (!parsed.success) return null;
  const database = await checkedDb();
  const rows = await database.execute<{ org_id: string; lead_id: string }>(sql`select org_id, lead_id from app_lead_unsubscribe_lookup(${parsed.data})`);
  return rows[0] ? { orgId: rows[0].org_id, leadId: rows[0].lead_id } : null;
}

/** Companies with automation emails due by `now`. The automation run calls this, then works in each tenant. */
export async function findOrgsWithDueAutomations(now: Date): Promise<string[]> {
  const database = await checkedDb();
  const rows = await database.execute<{ org_id: string }>(sql`select org_id from app_orgs_with_due_automations(${now.toISOString()}::timestamptz) as org_id`);
  return rows.map((row) => row.org_id);
}

/** Close the pool (scripts and tests; Next.js keeps it for the process lifetime). */
export async function closeDb(): Promise<void> {
  await client?.end();
  client = undefined;
  db = undefined;
  roleCheck = undefined;
}

export { schema };
