/**
 * Client queries. Each takes the tenant transaction from `withTenant`/`withSession`, so RLS has already
 * scoped it to one organization; the `orgId` filters below are belt and braces, not the security boundary.
 */
import "server-only";
import { and, asc, count, eq, ilike, isNotNull, isNull, or, sql } from "drizzle-orm";
import { likePattern } from "@/core/clients";
import type { ClientInput } from "@/core/schemas";
import type { Tx } from "./index";
import { clients, quotes } from "./schema";

export const CLIENTS_PAGE_SIZE = 50;

export type ClientRow = typeof clients.$inferSelect;
export type ClientListItem = Pick<ClientRow, "id" | "name" | "email" | "phone" | "address" | "source" | "archivedAt" | "createdAt">;

export type ClientListOptions = { search?: string; archived?: boolean; page?: number };

/** One page of clients, alphabetical. `hasMore` says whether another page exists. */
export async function listClients(tx: Tx, orgId: string, { search, archived = false, page = 1 }: ClientListOptions = {}) {
  const term = search?.trim().slice(0, 100);
  const pattern = term ? likePattern(term) : undefined;
  const rows = await tx
    .select({
      id: clients.id,
      name: clients.name,
      email: clients.email,
      phone: clients.phone,
      address: clients.address,
      source: clients.source,
      archivedAt: clients.archivedAt,
      createdAt: clients.createdAt,
    })
    .from(clients)
    .where(
      and(
        eq(clients.orgId, orgId),
        archived ? isNotNull(clients.archivedAt) : isNull(clients.archivedAt),
        pattern
          ? or(
              ilike(clients.name, pattern),
              ilike(clients.email, pattern),
              ilike(clients.phone, pattern),
              ilike(sql`${clients.address}->>'line1'`, pattern),
              ilike(sql`${clients.address}->>'town'`, pattern),
              // Postcodes are stored upper-case with a space; match "bs78aa" as well as "BS7 8AA".
              ilike(sql`replace(${clients.address}->>'postcode', ' ', '')`, likePattern(term!.replace(/\s/g, ""))),
            )
          : undefined,
      ),
    )
    .orderBy(asc(sql`lower(${clients.name})`), asc(clients.id))
    .limit(CLIENTS_PAGE_SIZE + 1)
    .offset((Math.max(1, Math.floor(page)) - 1) * CLIENTS_PAGE_SIZE);
  return { clients: rows.slice(0, CLIENTS_PAGE_SIZE), hasMore: rows.length > CLIENTS_PAGE_SIZE };
}

/** Active and archived counts, for the tabs. */
export async function countClients(tx: Tx, orgId: string) {
  const rows = await tx
    .select({ archived: isNotNull(clients.archivedAt).mapWith(Boolean), n: count() })
    .from(clients)
    .where(eq(clients.orgId, orgId))
    .groupBy(isNotNull(clients.archivedAt));
  return {
    active: rows.find((r) => !r.archived)?.n ?? 0,
    archived: rows.find((r) => r.archived)?.n ?? 0,
  };
}

export async function getClient(tx: Tx, orgId: string, clientId: string): Promise<ClientRow | undefined> {
  const [row] = await tx
    .select()
    .from(clients)
    .where(and(eq(clients.orgId, orgId), eq(clients.id, clientId)));
  return row;
}

/** Stored values for an input. Every optional field is written, so clearing one in the form clears it here. */
const columns = (input: ClientInput) => ({
  name: input.name,
  email: input.email ?? null,
  phone: input.phone ?? null,
  address: input.address ?? null,
  source: input.source ?? null,
  notes: input.notes ?? null,
});

export async function createClient(tx: Tx, orgId: string, input: ClientInput): Promise<string> {
  const [row] = await tx
    .insert(clients)
    .values({ orgId, ...columns(input) })
    .returning({ id: clients.id });
  return row.id;
}

/** Returns false if there's no such client in this organization. */
export async function updateClient(tx: Tx, orgId: string, clientId: string, input: ClientInput): Promise<boolean> {
  const rows = await tx
    .update(clients)
    .set(columns(input))
    .where(and(eq(clients.orgId, orgId), eq(clients.id, clientId)))
    .returning({ id: clients.id });
  return rows.length > 0;
}

export async function setClientArchived(tx: Tx, orgId: string, clientId: string, archived: boolean): Promise<boolean> {
  const rows = await tx
    .update(clients)
    .set({ archivedAt: archived ? new Date() : null })
    .where(and(eq(clients.orgId, orgId), eq(clients.id, clientId)))
    .returning({ id: clients.id });
  return rows.length > 0;
}

export async function countClientQuotes(tx: Tx, orgId: string, clientId: string): Promise<number> {
  const [row] = await tx
    .select({ n: count() })
    .from(quotes)
    .where(and(eq(quotes.orgId, orgId), eq(quotes.clientId, clientId)));
  return row?.n ?? 0;
}

/**
 * Permanently delete a client. Refused while any quote points at them (archive instead): quotes are
 * financial records. The foreign key enforces the same, this just gives a friendly answer first.
 */
export async function deleteClient(tx: Tx, orgId: string, clientId: string): Promise<"deleted" | "not_found" | "has_quotes"> {
  if ((await countClientQuotes(tx, orgId, clientId)) > 0) return "has_quotes";
  const rows = await tx
    .delete(clients)
    .where(and(eq(clients.orgId, orgId), eq(clients.id, clientId)))
    .returning({ id: clients.id });
  return rows.length > 0 ? "deleted" : "not_found";
}

/** Clients for a picker: active ones alphabetically, plus `includeId` even if it's archived. */
export async function clientOptions(tx: Tx, orgId: string, includeId?: string) {
  return tx
    .select({ id: clients.id, name: clients.name, address: clients.address })
    .from(clients)
    .where(and(eq(clients.orgId, orgId), includeId ? or(isNull(clients.archivedAt), eq(clients.id, includeId)) : isNull(clients.archivedAt)))
    .orderBy(asc(sql`lower(${clients.name})`))
    .limit(5_000);
}
