/** Example data at onboarding: added once, complete, kept out of limits and Xero, and removed cleanly. */
import { randomUUID } from "node:crypto";
import { and, count, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { appUrl } from "@/test/db-urls";
import { firstSendsSince } from "./billing";
import { createClient } from "./clients";
import { closeDb, withTenant, type Tx } from "./index";
import { createInvoice, listInvoices } from "./invoices";
import { listQuotes, createQuote } from "./quotes";
import { addSampleData, declineSampleData, removeSampleData, SampleDataInUse, sampleDataCanBeAdded, sampleDataState, shouldOfferSampleData } from "./sample-data";
import { clients, invoices, leads, projectTasks, projects, quotes, services } from "./schema";

const TODAY = "2026-10-18";
const clerkId = (uuid: string) => `org_${uuid.replaceAll("-", "")}`;

async function newOrg() {
  const orgId = randomUUID();
  await withTenant(orgId, (tx) => tx.execute(sql`insert into organizations (id, clerk_org_id, name) values (${orgId}, ${clerkId(orgId)}, 'Hale & Sons')`));
  const memberId = await withTenant(
    orgId,
    async (tx) =>
      (
        await tx.execute<{ id: string }>(sql`insert into members (org_id, clerk_user_id, role, name) values (${orgId}, ${"user_" + orgId.slice(0, 8)}, 'admin', 'Jo') returning id`)
      )[0].id,
  );
  return { orgId, memberId };
}
const n = async (tx: Tx, table: typeof clients | typeof services | typeof quotes | typeof invoices | typeof projects | typeof leads, orgId: string) =>
  (await tx.select({ n: count() }).from(table).where(eq(table.orgId, orgId)))[0].n;

beforeAll(() => {
  process.env.DATABASE_URL = appUrl();
});
afterAll(async () => {
  await closeDb();
});

describe("example data", () => {
  it("adds a working set once, keeps it out of the Free allowance and Xero, then removes exactly it", async () => {
    const { orgId, memberId } = await newOrg();
    await withTenant(orgId, async (tx) => {
      expect(await shouldOfferSampleData(tx, orgId)).toBe(true);
      expect(await addSampleData(tx, orgId, memberId, TODAY)).toBe(true);
      expect(await addSampleData(tx, orgId, memberId, TODAY)).toBe(false); // a double click adds nothing
      expect(await sampleDataState(tx, orgId)).toBe("added");
      expect(await shouldOfferSampleData(tx, orgId)).toBe(false);

      expect([await n(tx, services, orgId), await n(tx, clients, orgId), await n(tx, leads, orgId), await n(tx, quotes, orgId), await n(tx, projects, orgId)]).toEqual([
        6, 3, 2, 2, 1,
      ]);
      const inv = await listInvoices(tx, orgId, "all", TODAY);
      expect(inv.map((i) => [i.number, i.status])).toEqual([
        [2, "issued"],
        [1, "paid"],
      ]);
      expect((await listQuotes(tx, orgId)).quotes.map((q) => q.status).sort()).toEqual(["accepted", "sent"]);
      const tasks = await tx.select({ status: projectTasks.status }).from(projectTasks).where(eq(projectTasks.orgId, orgId));
      expect(tasks.length).toBeGreaterThanOrEqual(5);
      expect(new Set(tasks.map((t) => t.status))).toEqual(new Set(["done", "in_progress", "todo"]));
      expect(await tx.select({ s: invoices.isSample }).from(invoices).where(eq(invoices.orgId, orgId))).toEqual([{ s: true }, { s: true }]);
      // Example quotes don't use up the Free plan's three a month.
      expect(await firstSendsSince(tx, orgId, new Date(Date.now() - 86_400_000))).toBe(0);
    });

    // Real work alongside it stays.
    const realClient = await withTenant(orgId, (tx) => createClient(tx, orgId, { name: "A real client" }));
    await withTenant(orgId, async (tx) => {
      expect(await removeSampleData(tx, orgId)).toBe(16); // 2 invoices, 2 leads, 1 project, 2 quotes, 3 clients, 6 services
      expect([await n(tx, services, orgId), await n(tx, quotes, orgId), await n(tx, invoices, orgId), await n(tx, projects, orgId), await n(tx, leads, orgId)]).toEqual([
        0, 0, 0, 0, 0,
      ]);
      expect((await tx.select({ id: clients.id }).from(clients).where(eq(clients.orgId, orgId))).map((c) => c.id)).toEqual([realClient]);
      expect(await sampleDataState(tx, orgId)).toBe("removed");
      // Numbering starts again for real work.
      const q = await createQuote(tx, orgId, { clientId: realClient, title: "First real quote" });
      expect(
        (
          await tx
            .select({ number: quotes.number })
            .from(quotes)
            .where(and(eq(quotes.orgId, orgId), eq(quotes.id, q)))
        )[0].number,
      ).toBe(1);
    });
  });

  it("isn't offered to a company that has work or answered, and won't remove examples real work depends on", async () => {
    const { orgId, memberId } = await newOrg();
    await withTenant(orgId, async (tx) => {
      await declineSampleData(tx, orgId);
      expect(await shouldOfferSampleData(tx, orgId)).toBe(false); // asked once
      expect(await sampleDataCanBeAdded(tx, orgId)).toBe(true); // but can still add it from Settings
      expect(await addSampleData(tx, orgId, memberId, TODAY)).toBe(true);
    });
    const other = await newOrg();
    await withTenant(other.orgId, (tx) => createClient(tx, other.orgId, { name: "Existing" }));
    expect(await withTenant(other.orgId, (tx) => shouldOfferSampleData(tx, other.orgId))).toBe(false);
    // Never mixed in with a company's own work: it would take the first quote and invoice numbers.
    await expect(withTenant(other.orgId, (tx) => addSampleData(tx, other.orgId, other.memberId, TODAY))).rejects.toBeInstanceOf(SampleDataInUse);
    expect(await withTenant(other.orgId, (tx) => sampleDataState(tx, other.orgId))).toBeNull();

    const third = await newOrg();
    await withTenant(third.orgId, (tx) => addSampleData(tx, third.orgId, third.memberId, TODAY));
    // A real invoice raised on the example quote: removing would break it, so nothing goes.
    await withTenant(third.orgId, async (tx) => {
      await tx.execute(sql`update organizations set bank_account_name = 'Hale', bank_sort_code = '123456', bank_account_number = '12345678' where id = ${third.orgId}`);
      const [q] = await tx
        .select({ id: quotes.id })
        .from(quotes)
        .where(and(eq(quotes.orgId, third.orgId), eq(quotes.status, "accepted")));
      const [stage] = await tx.execute<{ id: string }>(
        sql`select (snapshot->'paymentPlan'->2->>'id') as id from quote_versions where org_id = ${third.orgId} and quote_id = ${q.id}`,
      );
      await createInvoice(tx, third.orgId, { quoteId: q.id, stageId: stage.id, memberId: third.memberId }, TODAY);
    });
    await expect(withTenant(third.orgId, (tx) => removeSampleData(tx, third.orgId))).rejects.toBeInstanceOf(SampleDataInUse);
    expect(await withTenant(third.orgId, (tx) => n(tx, quotes, third.orgId))).toBe(2);
  });

  it("only ever removes the caller's own company", async () => {
    const a = await newOrg();
    const b = await newOrg();
    await withTenant(b.orgId, (tx) => addSampleData(tx, b.orgId, b.memberId, TODAY));
    await expect(withTenant(a.orgId, (tx) => tx.execute(sql`select app_remove_sample_data(${b.orgId}::uuid)`))).rejects.toMatchObject({ cause: { code: "42501" } });
    expect(await withTenant(b.orgId, (tx) => n(tx, quotes, b.orgId))).toBe(2);
  });
});
