/**
 * Service library queries. Each takes the tenant transaction from `withTenant`/`withSession`; RLS is the
 * security boundary and the `orgId` filters are belt and braces.
 *
 * Bundles have no rate of their own: `rate_pence` on a bundle row is the sum of its items, kept in step here
 * whenever a bundle's items or one of its services' rates change.
 */
import "server-only";
import { and, asc, count, desc, eq, ilike, inArray, isNotNull, isNull, ne, or, sql } from "drizzle-orm";
import { likePattern } from "@/core/clients";
import { duplicateKey } from "@/core/library-import";
import { bundleRate, bundleRateTooHigh } from "@/core/services";
import type { BundleInput, ServiceInput } from "@/core/schemas";
import type { Tx } from "./index";
import { quoteLines, serviceBundleItems, services } from "./schema";

export const SERVICES_PAGE_SIZE = 60;

export type ServiceRow = typeof services.$inferSelect;
export type ServiceKindFilter = "all" | "service" | "bundle";
export type ServiceListOptions = { search?: string; category?: string; kind?: ServiceKindFilter; archived?: boolean; page?: number };

export class BundleError extends Error {
  constructor(readonly reason: "unknown_service" | "nested_bundle" | "too_expensive") {
    super(reason);
  }
}

/** One page of the library: most used first, then alphabetical. */
export async function listServices(tx: Tx, orgId: string, { search, category, kind = "all", archived = false, page = 1 }: ServiceListOptions = {}) {
  const term = search?.trim().slice(0, 100);
  const pattern = term ? likePattern(term) : undefined;
  const rows = await tx
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
      itemCount: sql<number>`(select count(*) from ${serviceBundleItems} i where i.org_id = ${services.orgId} and i.bundle_id = ${services.id})`.mapWith(Number),
    })
    .from(services)
    .where(
      and(
        eq(services.orgId, orgId),
        archived ? isNotNull(services.archivedAt) : isNull(services.archivedAt),
        category ? sql`lower(${services.category}) = lower(${category})` : undefined,
        kind === "all" ? undefined : eq(services.kind, kind),
        pattern ? or(ilike(services.name, pattern), ilike(services.description, pattern), ilike(services.category, pattern)) : undefined,
      ),
    )
    .orderBy(desc(services.usageCount), asc(sql`lower(${services.name})`), asc(services.id))
    .limit(SERVICES_PAGE_SIZE + 1)
    .offset((Math.max(1, Math.floor(page)) - 1) * SERVICES_PAGE_SIZE);
  return { services: rows.slice(0, SERVICES_PAGE_SIZE), hasMore: rows.length > SERVICES_PAGE_SIZE };
}

/** Active categories with counts, alphabetical, plus the active and archived totals. */
export async function libraryCounts(tx: Tx, orgId: string) {
  const categories = await tx
    .select({ category: sql<string>`min(${services.category})`, n: count() })
    .from(services)
    .where(and(eq(services.orgId, orgId), isNull(services.archivedAt)))
    .groupBy(sql`lower(${services.category})`)
    .orderBy(sql`lower(min(${services.category}))`);
  const [totals] = await tx
    .select({
      active: sql<number>`count(*) filter (where ${services.archivedAt} is null)`.mapWith(Number),
      archived: sql<number>`count(*) filter (where ${services.archivedAt} is not null)`.mapWith(Number),
    })
    .from(services)
    .where(eq(services.orgId, orgId));
  return { categories, active: totals?.active ?? 0, archived: totals?.archived ?? 0 };
}

export async function getService(tx: Tx, orgId: string, serviceId: string) {
  const [service] = await tx
    .select()
    .from(services)
    .where(and(eq(services.orgId, orgId), eq(services.id, serviceId)));
  if (!service) return undefined;
  const items =
    service.kind === "bundle"
      ? await tx
          .select({
            serviceId: services.id,
            qty: serviceBundleItems.qty,
            name: services.name,
            unit: services.unit,
            ratePence: services.ratePence,
            archived: isNotNull(services.archivedAt).mapWith(Boolean),
          })
          .from(serviceBundleItems)
          .innerJoin(services, and(eq(services.orgId, serviceBundleItems.orgId), eq(services.id, serviceBundleItems.serviceId)))
          .where(and(eq(serviceBundleItems.orgId, orgId), eq(serviceBundleItems.bundleId, serviceId)))
          .orderBy(asc(sql`lower(${services.name})`))
      : [];
  // Bundles this service belongs to, so the page can say where a rate change will show up.
  const inBundles =
    service.kind === "service"
      ? await tx
          .select({ id: services.id, name: services.name })
          .from(serviceBundleItems)
          .innerJoin(services, and(eq(services.orgId, serviceBundleItems.orgId), eq(services.id, serviceBundleItems.bundleId)))
          .where(and(eq(serviceBundleItems.orgId, orgId), eq(serviceBundleItems.serviceId, serviceId)))
          .orderBy(asc(sql`lower(${services.name})`))
      : [];
  return { service, items: items.map((i) => ({ ...i, qty: Number(i.qty) })), inBundles };
}

/** Services (not bundles) a bundle can contain: active ones, plus any already in `includeIds`. */
export async function bundleCandidates(tx: Tx, orgId: string, includeIds: string[] = []) {
  return tx
    .select({ id: services.id, category: services.category, name: services.name, unit: services.unit, ratePence: services.ratePence })
    .from(services)
    .where(
      and(
        eq(services.orgId, orgId),
        eq(services.kind, "service"),
        includeIds.length > 0 ? or(isNull(services.archivedAt), inArray(services.id, includeIds)) : isNull(services.archivedAt),
      ),
    )
    .orderBy(asc(sql`lower(${services.category})`), asc(sql`lower(${services.name})`))
    .limit(2_000);
}

const serviceColumns = (input: ServiceInput) => ({
  category: input.category,
  name: input.name,
  description: input.description ?? null,
  unit: input.unit,
  ratePence: input.ratePence,
  defaultMarkupBps: input.defaultMarkupBps ?? null,
});

export async function createService(tx: Tx, orgId: string, input: ServiceInput): Promise<string> {
  const [row] = await tx
    .insert(services)
    .values({ orgId, kind: "service", ...serviceColumns(input) })
    .returning({ id: services.id });
  return row.id;
}

/**
 * Update a service (never a bundle: that's `updateBundle`). Bundles containing it are repriced in the same
 * transaction. Throws `BundleError("too_expensive")` if that would push a bundle past the rate limit.
 */
export async function updateService(tx: Tx, orgId: string, serviceId: string, input: ServiceInput): Promise<boolean> {
  const rows = await tx
    .update(services)
    .set(serviceColumns(input))
    .where(and(eq(services.orgId, orgId), eq(services.id, serviceId), eq(services.kind, "service")))
    .returning({ id: services.id });
  if (rows.length === 0) return false;
  await repriceBundlesContaining(tx, orgId, serviceId);
  return true;
}

async function repriceBundlesContaining(tx: Tx, orgId: string, serviceId: string) {
  const bundleIds = (
    await tx
      .select({ id: serviceBundleItems.bundleId })
      .from(serviceBundleItems)
      .where(and(eq(serviceBundleItems.orgId, orgId), eq(serviceBundleItems.serviceId, serviceId)))
  ).map((r) => r.id);
  for (const id of bundleIds) await repriceBundle(tx, orgId, id);
}

async function repriceBundle(tx: Tx, orgId: string, bundleId: string) {
  const items = await tx
    .select({ qty: serviceBundleItems.qty, ratePence: services.ratePence })
    .from(serviceBundleItems)
    .innerJoin(services, and(eq(services.orgId, serviceBundleItems.orgId), eq(services.id, serviceBundleItems.serviceId)))
    .where(and(eq(serviceBundleItems.orgId, orgId), eq(serviceBundleItems.bundleId, bundleId)));
  const rate = bundleRate(items.map((i) => ({ qty: Number(i.qty), ratePence: i.ratePence })));
  if (bundleRateTooHigh(rate)) throw new BundleError("too_expensive");
  await tx
    .update(services)
    .set({ ratePence: rate })
    .where(and(eq(services.orgId, orgId), eq(services.id, bundleId)));
}

/** Check every item is one of this company's services and not itself a bundle. */
async function checkItems(tx: Tx, orgId: string, input: BundleInput, selfId?: string) {
  const ids = input.items.map((i) => i.serviceId);
  if (selfId && ids.includes(selfId)) throw new BundleError("nested_bundle");
  const found = await tx
    .select({ id: services.id, kind: services.kind })
    .from(services)
    .where(and(eq(services.orgId, orgId), inArray(services.id, ids)));
  if (found.length !== ids.length) throw new BundleError("unknown_service");
  if (found.some((s) => s.kind !== "service")) throw new BundleError("nested_bundle");
}

const bundleColumns = (input: BundleInput) => ({
  category: input.category,
  name: input.name,
  description: input.description ?? null,
  unit: input.unit,
  defaultMarkupBps: input.defaultMarkupBps ?? null,
});

const itemRows = (orgId: string, bundleId: string, input: BundleInput) =>
  input.items.map((i) => ({ orgId, bundleId, serviceId: i.serviceId, qty: String(i.qty) }));

export async function createBundle(tx: Tx, orgId: string, input: BundleInput): Promise<string> {
  await checkItems(tx, orgId, input);
  const [row] = await tx
    .insert(services)
    .values({ orgId, kind: "bundle", ratePence: 0, ...bundleColumns(input) })
    .returning({ id: services.id });
  await tx.insert(serviceBundleItems).values(itemRows(orgId, row.id, input));
  await repriceBundle(tx, orgId, row.id);
  return row.id;
}

/** Replace a bundle's details and items, and reprice it. */
export async function updateBundle(tx: Tx, orgId: string, bundleId: string, input: BundleInput): Promise<boolean> {
  await checkItems(tx, orgId, input, bundleId);
  const rows = await tx
    .update(services)
    .set(bundleColumns(input))
    .where(and(eq(services.orgId, orgId), eq(services.id, bundleId), eq(services.kind, "bundle")))
    .returning({ id: services.id });
  if (rows.length === 0) return false;
  await tx.delete(serviceBundleItems).where(and(eq(serviceBundleItems.orgId, orgId), eq(serviceBundleItems.bundleId, bundleId)));
  await tx.insert(serviceBundleItems).values(itemRows(orgId, bundleId, input));
  await repriceBundle(tx, orgId, bundleId);
  return true;
}

export async function setServiceArchived(tx: Tx, orgId: string, serviceId: string, archived: boolean): Promise<boolean> {
  const rows = await tx
    .update(services)
    .set({ archivedAt: archived ? new Date() : null })
    .where(and(eq(services.orgId, orgId), eq(services.id, serviceId)))
    .returning({ id: services.id });
  return rows.length > 0;
}

/** Why a service or bundle can't be deleted (archive it instead), or null if it can. */
export async function deleteBlocker(tx: Tx, orgId: string, serviceId: string): Promise<"on_quotes" | "in_bundles" | null> {
  const [lines] = await tx
    .select({ n: count() })
    .from(quoteLines)
    .where(and(eq(quoteLines.orgId, orgId), eq(quoteLines.serviceId, serviceId)));
  if ((lines?.n ?? 0) > 0) return "on_quotes";
  const [bundles] = await tx
    .select({ n: count() })
    .from(serviceBundleItems)
    .where(and(eq(serviceBundleItems.orgId, orgId), eq(serviceBundleItems.serviceId, serviceId), ne(serviceBundleItems.bundleId, serviceId)));
  if ((bundles?.n ?? 0) > 0) return "in_bundles";
  return null;
}

/**
 * Permanently delete a service or bundle that no quote uses and no bundle contains. A bundle's own item rows
 * go with it (foreign key cascade); its services stay.
 */
export async function deleteService(tx: Tx, orgId: string, serviceId: string): Promise<"deleted" | "not_found" | "on_quotes" | "in_bundles"> {
  const blocker = await deleteBlocker(tx, orgId, serviceId);
  if (blocker) return blocker;
  const rows = await tx
    .delete(services)
    .where(and(eq(services.orgId, orgId), eq(services.id, serviceId)))
    .returning({ id: services.id });
  return rows.length > 0 ? "deleted" : "not_found";
}

/** `duplicateKey`s for everything in the library, archived included, so an import doesn't recreate them. */
export async function libraryKeys(tx: Tx, orgId: string): Promise<Set<string>> {
  const rows = await tx.select({ category: services.category, name: services.name }).from(services).where(eq(services.orgId, orgId));
  return new Set(rows.map((r) => duplicateKey(r.category, r.name)));
}

/** Insert imported services in one statement. Returns how many were added. */
export async function importServices(tx: Tx, orgId: string, inputs: ServiceInput[]): Promise<number> {
  if (inputs.length === 0) return 0;
  const rows = await tx
    .insert(services)
    .values(inputs.map((input) => ({ orgId, kind: "service" as const, ...serviceColumns(input) })))
    .returning({ id: services.id });
  return rows.length;
}
