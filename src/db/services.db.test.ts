/** Service library queries against real Postgres as the app role. */
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { appUrl } from "@/test/db-urls";
import { createClient } from "./clients";
import { closeDb, withTenant } from "./index";
import { quoteLines, quoteSections, quotes } from "./schema";
import {
  BundleError,
  bundleCandidates,
  createBundle,
  createService,
  deleteService,
  getService,
  libraryCounts,
  listServices,
  setServiceArchived,
  updateBundle,
  updateService,
} from "./services";

const clerkId = (uuid: string) => `org_${uuid.replaceAll("-", "")}`;

async function newOrg(name: string): Promise<string> {
  const orgId = randomUUID();
  await withTenant(orgId, (tx) => tx.execute(sql`insert into organizations (id, clerk_org_id, name) values (${orgId}, ${clerkId(orgId)}, ${name})`));
  return orgId;
}

const svc = (name: string, ratePence: number, category = "Plastering", unit = "m²") => ({ kind: "service" as const, category, name, unit, ratePence });

beforeAll(() => {
  process.env.DATABASE_URL = appUrl();
});

afterAll(async () => {
  await closeDb();
});

describe("services", () => {
  it("creates and updates, clearing optional fields", async () => {
    const org = await newOrg("Svc CRUD");
    await withTenant(org, async (tx) => {
      const id = await createService(tx, org, { ...svc("Skim, walls", 1_450), description: "Two coats", defaultMarkupBps: 1500 });
      expect((await getService(tx, org, id))?.service).toMatchObject({ name: "Skim, walls", ratePence: 1_450, defaultMarkupBps: 1500, description: "Two coats", kind: "service" });
      expect(await updateService(tx, org, id, svc("Skim, walls", 1_500))).toBe(true);
      expect((await getService(tx, org, id))?.service).toMatchObject({ ratePence: 1_500, defaultMarkupBps: null, description: null });
    });
  });

  it("lists by category, kind and search, with category counts", async () => {
    const org = await newOrg("Svc list");
    await withTenant(org, async (tx) => {
      const skim = await createService(tx, org, svc("Plaster skim", 1_450));
      await createService(tx, org, svc("Socket", 14_500, "Electrical", "point"));
      await createService(tx, org, svc("Bonding", 1_900, "plastering"));
      await createBundle(tx, org, { category: "Plastering", name: "Room skim", unit: "room", items: [{ serviceId: skim, qty: 30 }] });
      const names = async (opts: Parameters<typeof listServices>[2]) => (await listServices(tx, org, opts)).services.map((s) => s.name);
      expect(await names({ category: "PLASTERING" })).toEqual(["Bonding", "Plaster skim", "Room skim"]);
      expect(await names({ kind: "bundle" })).toEqual(["Room skim"]);
      expect(await names({ search: "sock" })).toEqual(["Socket"]);
      expect(await names({ search: "electr" })).toEqual(["Socket"]);
      const counts = await libraryCounts(tx, org);
      expect(counts.categories.map((c) => [c.category.toLowerCase(), c.n])).toEqual([["electrical", 1], ["plastering", 3]]);
      expect(counts).toMatchObject({ active: 4, archived: 0 });
      expect((await listServices(tx, org, { kind: "bundle" })).services[0].itemCount).toBe(1);
    });
  });

  it("prices a bundle from its items and reprices it when an item's rate changes", async () => {
    const org = await newOrg("Bundles");
    await withTenant(org, async (tx) => {
      const skim = await createService(tx, org, svc("Skim", 1_450));
      const beam = await createService(tx, org, svc("Steel beam", 185_000, "Structural", "item"));
      const bundle = await createBundle(tx, org, { category: "Structural", name: "Knock through", unit: "job", items: [{ serviceId: skim, qty: 6.2 }, { serviceId: beam, qty: 1 }] });
      expect((await getService(tx, org, bundle))?.service.ratePence).toBe(8_990 + 185_000);

      await updateService(tx, org, skim, svc("Skim", 1_500));
      expect((await getService(tx, org, bundle))?.service.ratePence).toBe(9_300 + 185_000);

      await updateBundle(tx, org, bundle, { category: "Structural", name: "Knock through", unit: "job", items: [{ serviceId: beam, qty: 2 }] });
      const found = await getService(tx, org, bundle);
      expect(found?.service.ratePence).toBe(370_000);
      expect(found?.items).toEqual([{ serviceId: beam, qty: 2, name: "Steel beam", unit: "item", ratePence: 185_000, archived: false }]);
      expect((await getService(tx, org, beam))?.inBundles).toEqual([{ id: bundle, name: "Knock through" }]);
    });
  });

  it("refuses bundles inside bundles, unknown services and runaway prices", async () => {
    const org = await newOrg("Bundle rules");
    await withTenant(org, async (tx) => {
      const skim = await createService(tx, org, svc("Skim", 1_450));
      const bundle = await createBundle(tx, org, { category: "A", name: "B", unit: "job", items: [{ serviceId: skim, qty: 1 }] });
      const reason = (p: Promise<unknown>) => p.then(() => "ok", (e: unknown) => (e instanceof BundleError ? e.reason : String(e)));
      expect(await reason(createBundle(tx, org, { category: "A", name: "C", unit: "job", items: [{ serviceId: bundle, qty: 1 }] }))).toBe("nested_bundle");
      expect(await reason(updateBundle(tx, org, bundle, { category: "A", name: "B", unit: "job", items: [{ serviceId: bundle, qty: 1 }] }))).toBe("nested_bundle");
      expect(await reason(createBundle(tx, org, { category: "A", name: "C", unit: "job", items: [{ serviceId: randomUUID(), qty: 1 }] }))).toBe("unknown_service");
      const pricey = await createService(tx, org, svc("Pricey", 900_000_000));
      expect(await reason(createBundle(tx, org, { category: "A", name: "D", unit: "job", items: [{ serviceId: pricey, qty: 2 }] }))).toBe("too_expensive");
      // updateService can't turn a bundle into a service or change its rate directly.
      expect(await updateService(tx, org, bundle, svc("Hack", 1))).toBe(false);
    });
  });

  it("archives, and deletes only what nothing else uses", async () => {
    const org = await newOrg("Svc delete");
    await withTenant(org, async (tx) => {
      const used = await createService(tx, org, svc("Used on a quote", 100));
      const inBundle = await createService(tx, org, svc("In a bundle", 100));
      const free = await createService(tx, org, svc("Unused", 100));
      const bundle = await createBundle(tx, org, { category: "A", name: "Bundle", unit: "job", items: [{ serviceId: inBundle, qty: 1 }] });
      const client = await createClient(tx, org, { name: "C" });
      const [quote] = await tx.insert(quotes).values({ orgId: org, clientId: client, number: 1, title: "Q", markupBps: 0, vatRateBps: 2000 }).returning();
      const [section] = await tx.insert(quoteSections).values({ orgId: org, quoteId: quote.id, position: 0, name: "S" }).returning();
      await tx.insert(quoteLines).values({ orgId: org, sectionId: section.id, position: 0, serviceId: used, name: "L", qty: "1", unit: "m²", ratePence: 100, markupBps: 0 });

      expect(await deleteService(tx, org, used)).toBe("on_quotes");
      expect(await deleteService(tx, org, inBundle)).toBe("in_bundles");
      expect(await deleteService(tx, org, free)).toBe("deleted");
      // Deleting the bundle frees its service, which stays.
      expect(await deleteService(tx, org, bundle)).toBe("deleted");
      expect(await deleteService(tx, org, inBundle)).toBe("deleted");

      expect(await setServiceArchived(tx, org, used, true)).toBe(true);
      expect((await listServices(tx, org)).services).toEqual([]);
      expect((await listServices(tx, org, { archived: true })).services.map((s) => s.name)).toEqual(["Used on a quote"]);
      expect(await libraryCounts(tx, org)).toMatchObject({ active: 0, archived: 1, categories: [] });
      // Archived services drop out of the bundle picker unless the bundle already has them.
      expect(await bundleCandidates(tx, org)).toEqual([]);
      expect((await bundleCandidates(tx, org, [used])).map((s) => s.id)).toEqual([used]);
    });
  });

  it("can't see or change another company's services, or put them in a bundle", async () => {
    const a = await newOrg("Svc A");
    const b = await newOrg("Svc B");
    const theirs = await withTenant(b, (tx) => createService(tx, b, svc("B's service", 100)));
    await withTenant(a, async (tx) => {
      expect(await getService(tx, b, theirs)).toBeUndefined();
      expect(await updateService(tx, a, theirs, svc("Hijacked", 1))).toBe(false);
      expect(await setServiceArchived(tx, a, theirs, true)).toBe(false);
      expect(await deleteService(tx, a, theirs)).toBe("not_found");
      await expect(createBundle(tx, a, { category: "A", name: "Steal", unit: "job", items: [{ serviceId: theirs, qty: 1 }] })).rejects.toThrow("unknown_service");
    });
    await withTenant(b, async (tx) => expect((await getService(tx, b, theirs))?.service).toMatchObject({ name: "B's service", ratePence: 100, archivedAt: null }));
  });
});
