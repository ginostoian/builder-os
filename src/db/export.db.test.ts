/** GDPR exports: a company gets all of its own data and nobody else's; a client export is just that client. */
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { appUrl } from "@/test/db-urls";
import { createClient } from "./clients";
import { exportClient, exportCompany, toCsv } from "./export";
import { closeDb, withTenant } from "./index";
import { createQuote } from "./quotes";
import { ensurePortalToken } from "./sending";

const clerkId = (uuid: string) => `org_${uuid.replaceAll("-", "")}`;

async function newOrg(name: string) {
  const orgId = randomUUID();
  await withTenant(orgId, (tx) => tx.execute(sql`insert into organizations (id, clerk_org_id, name) values (${orgId}, ${clerkId(orgId)}, ${name})`));
  const memberId = await withTenant(orgId, async (tx) => (await tx.execute<{ id: string }>(sql`insert into members (org_id, clerk_user_id, role, name) values (${orgId}, ${"user_" + randomUUID().slice(0, 8)}, 'admin', 'Jo') returning id`))[0].id);
  return { orgId, memberId };
}

beforeAll(() => {
  process.env.DATABASE_URL = appUrl();
});
afterAll(async () => {
  await closeDb();
});

describe("data export", () => {
  it("exports the company's own data, without credentials", async () => {
    const a = await newOrg("Export A");
    const b = await newOrg("Export B");
    const sarah = await withTenant(a.orgId, async (tx) => {
      const id = await createClient(tx, a.orgId, { name: "Sarah Hale", email: "sarah@example.com" });
      await createQuote(tx, a.orgId, { clientId: id, title: "Kitchen" });
      await ensurePortalToken(tx, a.orgId, id);
      return id;
    });
    await withTenant(b.orgId, (tx) => createClient(tx, b.orgId, { name: "Other company's client" }));

    const tables = await withTenant(a.orgId, (tx) => exportCompany(tx, a.orgId));
    const names = tables.map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining(["organizations", "members", "clients", "quotes", "portal_access", "invoices"]));
    expect(names).not.toContain("portal_codes");
    expect(names).not.toContain("rate_limits");
    const all = JSON.stringify(tables);
    expect(all).toContain("Sarah Hale");
    expect(all).not.toContain("Other company");
    const portal = tables.find((t) => t.name === "portal_access")!;
    expect(portal.rows[0].token).toBe("[removed]");
    expect(tables.find((t) => t.name === "organizations")!.rows).toHaveLength(1);

    const client = (await withTenant(a.orgId, (tx) => exportClient(tx, a.orgId, sarah)))!;
    expect(client.map((t) => t.name)).toEqual(expect.arrayContaining(["clients", "quotes", "portal_access"]));
    expect(client.find((t) => t.name === "clients")!.rows).toHaveLength(1);
    expect(await withTenant(b.orgId, (tx) => exportClient(tx, b.orgId, sarah))).toBeNull();
  });

  it("writes CSV that spreadsheets can't run as formulas", () => {
    const csv = toCsv({ name: "t", columns: ["a", "b"], rows: [{ a: "=HYPERLINK(\"x\")", b: 'say "hi", ok' }] });
    expect(csv).toBe('a,b\r\n"\'=HYPERLINK(""x"")","say ""hi"", ok"\r\n');
  });
});
