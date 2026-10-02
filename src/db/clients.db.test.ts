/** Client queries against real Postgres as the app role: search, archive, delete rules and tenant scoping. */
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { appUrl } from "@/test/db-urls";
import {
  CLIENTS_PAGE_SIZE,
  countClients,
  createClient,
  deleteClient,
  getClient,
  listClients,
  setClientArchived,
  updateClient,
} from "./clients";
import { closeDb, withTenant } from "./index";
import { quotes } from "./schema";

const clerkId = (uuid: string) => `org_${uuid.replaceAll("-", "")}`;

async function newOrg(name: string): Promise<string> {
  const orgId = randomUUID();
  await withTenant(orgId, (tx) => tx.execute(sql`insert into organizations (id, clerk_org_id, name) values (${orgId}, ${clerkId(orgId)}, ${name})`));
  return orgId;
}

let a: string;
let b: string;

beforeAll(async () => {
  process.env.DATABASE_URL = appUrl();
  a = await newOrg("Clients A");
  b = await newOrg("Clients B");
});

afterAll(async () => {
  await closeDb();
});

describe("clients", () => {
  it("creates, reads and updates, clearing fields left blank", async () => {
    const id = await withTenant(a, (tx) =>
      createClient(tx, a, {
        name: "Sarah Hale",
        email: "sarah@example.com",
        phone: "07700 900123",
        address: { line1: "14 Elm Road", town: "Bristol", postcode: "BS7 8AA" },
        source: "Referral",
        notes: "Dog on site",
      }),
    );
    await withTenant(a, async (tx) => {
      expect(await getClient(tx, a, id)).toMatchObject({ name: "Sarah Hale", address: { postcode: "BS7 8AA" }, notes: "Dog on site", archivedAt: null });
      expect(await updateClient(tx, a, id, { name: "Sarah Hale-Jones" })).toBe(true);
      expect(await getClient(tx, a, id)).toMatchObject({ name: "Sarah Hale-Jones", email: null, address: null, notes: null });
    });
  });

  it("searches name, email, phone, street, town and postcode, with or without the space", async () => {
    const org = await newOrg("Search");
    await withTenant(org, async (tx) => {
      await createClient(tx, org, { name: "Tom Ashworth", email: "tom@ash.co.uk", address: { line1: "3 Mill Lane", town: "Bath", postcode: "BA1 2AB" } });
      await createClient(tx, org, { name: "Priya Shah", phone: "0117 496 0000" });
      await createClient(tx, org, { name: "100% Builders_Ltd" });
      const names = async (search: string) => (await listClients(tx, org, { search })).clients.map((c) => c.name);
      expect(await names("ashw")).toEqual(["Tom Ashworth"]);
      expect(await names("ASH.CO")).toEqual(["Tom Ashworth"]);
      expect(await names("mill lane")).toEqual(["Tom Ashworth"]);
      expect(await names("ba12ab")).toEqual(["Tom Ashworth"]);
      expect(await names("BA1 2")).toEqual(["Tom Ashworth"]);
      expect(await names("496")).toEqual(["Priya Shah"]);
      // Wildcards match literally, not as "anything".
      expect(await names("%")).toEqual(["100% Builders_Ltd"]);
      expect(await names("s_l")).toEqual(["100% Builders_Ltd"]);
      expect(await names("")).toEqual(["100% Builders_Ltd", "Priya Shah", "Tom Ashworth"]);
    });
  });

  it("pages alphabetically, case-insensitive", async () => {
    const org = await newOrg("Paging");
    await withTenant(org, async (tx) => {
      for (let i = 0; i < CLIENTS_PAGE_SIZE + 2; i++) await createClient(tx, org, { name: `${i % 2 ? "c" : "C"}lient ${String(i).padStart(3, "0")}` });
      const first = await listClients(tx, org);
      const second = await listClients(tx, org, { page: 2 });
      expect(first.clients).toHaveLength(CLIENTS_PAGE_SIZE);
      expect(first.hasMore).toBe(true);
      expect(second.clients.map((c) => c.name)).toEqual(["Client 050", "client 051"]);
      expect(second.hasMore).toBe(false);
    });
  });

  it("archives out of the main list and back", async () => {
    const org = await newOrg("Archive");
    await withTenant(org, async (tx) => {
      const id = await createClient(tx, org, { name: "Old Client" });
      await createClient(tx, org, { name: "Current Client" });
      expect(await setClientArchived(tx, org, id, true)).toBe(true);
      expect((await listClients(tx, org)).clients.map((c) => c.name)).toEqual(["Current Client"]);
      expect((await listClients(tx, org, { archived: true })).clients.map((c) => c.name)).toEqual(["Old Client"]);
      expect(await countClients(tx, org)).toEqual({ active: 1, archived: 1 });
      await setClientArchived(tx, org, id, false);
      expect(await countClients(tx, org)).toEqual({ active: 2, archived: 0 });
    });
  });

  it("deletes only clients without quotes", async () => {
    const org = await newOrg("Delete");
    await withTenant(org, async (tx) => {
      const free = await createClient(tx, org, { name: "No quotes" });
      const quoted = await createClient(tx, org, { name: "Has a quote" });
      await tx.insert(quotes).values({ orgId: org, clientId: quoted, number: 1, title: "Kitchen", markupBps: 0, vatRateBps: 2000 });
      expect(await deleteClient(tx, org, quoted)).toBe("has_quotes");
      expect(await deleteClient(tx, org, free)).toBe("deleted");
      expect(await deleteClient(tx, org, free)).toBe("not_found");
      expect(await getClient(tx, org, quoted)).toBeDefined();
    });
  });

  it("can't see or touch another company's client, even by id", async () => {
    const theirs = await withTenant(b, (tx) => createClient(tx, b, { name: "B's client" }));
    await withTenant(a, async (tx) => {
      // Passing B's org id doesn't help: RLS pins the transaction to A.
      expect(await getClient(tx, b, theirs)).toBeUndefined();
      expect(await getClient(tx, a, theirs)).toBeUndefined();
      expect(await updateClient(tx, a, theirs, { name: "Hijacked" })).toBe(false);
      expect(await setClientArchived(tx, b, theirs, true)).toBe(false);
      expect(await deleteClient(tx, a, theirs)).toBe("not_found");
      expect((await listClients(tx, b)).clients).toEqual([]);
    });
    await withTenant(b, async (tx) => expect(await getClient(tx, b, theirs)).toMatchObject({ name: "B's client", archivedAt: null }));
  });
});
