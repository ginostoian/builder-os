/**
 * Tenant isolation, tested against real Postgres as the real app role (plan §3 "Tenant isolation").
 * Two tenants, A and B. Nothing A does may read, change or reference B's data.
 */
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { appUrl, ownerUrl } from "@/test/db-urls";
import { closeDb, withTenant } from "./index";
import { clients, organizations, quoteLines, quoteSections, quotes, services } from "./schema";

type Seed = { orgId: string; clientId: string; quoteId: string; sectionId: string; lineId: string; serviceId: string };

async function seedTenant(name: string): Promise<Seed> {
  const orgId = randomUUID();
  return withTenant(orgId, async (tx) => {
    // The app role may only insert these organization columns (migration 0005), as the Clerk sync does.
    await tx.execute(sql`insert into organizations (id, clerk_org_id, name) values (${orgId}, ${clerkId(orgId)}, ${name})`);
    const [client] = await tx.insert(clients).values({ orgId, name: `${name} client` }).returning();
    const [service] = await tx
      .insert(services)
      .values({ orgId, category: "Plastering", name: "Skim", unit: "m²", ratePence: 1_450 })
      .returning();
    const [quote] = await tx
      .insert(quotes)
      .values({ orgId, clientId: client.id, number: 1042, title: "Kitchen", markupBps: 1500, vatRateBps: 2000 })
      .returning();
    const [section] = await tx.insert(quoteSections).values({ orgId, quoteId: quote.id, position: 0, name: "Prep" }).returning();
    const [line] = await tx
      .insert(quoteLines)
      .values({ orgId, sectionId: section.id, position: 0, serviceId: service.id, name: "Skim", qty: "6.200", unit: "m²", ratePence: 1_450, markupBps: 1500 })
      .returning();
    return { orgId, clientId: client.id, quoteId: quote.id, sectionId: section.id, lineId: line.id, serviceId: service.id };
  });
}

const clerkId = (uuid: string) => `org_${uuid.replaceAll("-", "")}`;

/** Postgres error code from a rejected promise (drizzle wraps driver errors in `cause`). */
async function pgError(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
  } catch (error) {
    const e = error as { code?: string; cause?: { code?: string } };
    return e.code ?? e.cause?.code ?? "unknown";
  }
  return undefined;
}

const INSUFFICIENT_PRIVILEGE = "42501";
const FOREIGN_KEY_VIOLATION = "23503";

let a: Seed;
let b: Seed;
let raw: postgres.Sql;

beforeAll(async () => {
  process.env.DATABASE_URL = appUrl();
  a = await seedTenant("Hale & Sons");
  b = await seedTenant("Rival Builders");
  raw = postgres(appUrl(), { max: 1, onnotice: () => {} });
});

afterAll(async () => {
  await raw?.end();
  await closeDb();
});

describe("reads", () => {
  it("only returns the current tenant's rows", async () => {
    await withTenant(a.orgId, async (tx) => {
      expect((await tx.select().from(organizations)).map((o) => o.id)).toEqual([a.orgId]);
      expect((await tx.select().from(clients)).map((c) => c.id)).toEqual([a.clientId]);
      expect((await tx.select().from(quotes)).map((q) => q.id)).toEqual([a.quoteId]);
      expect((await tx.select().from(quoteLines)).map((l) => l.id)).toEqual([a.lineId]);
    });
  });

  it("can't fetch another tenant's row even by exact id", async () => {
    await withTenant(a.orgId, async (tx) => {
      expect(await tx.select().from(quotes).where(eq(quotes.id, b.quoteId))).toEqual([]);
      expect(await tx.select().from(quoteLines).where(eq(quoteLines.orgId, b.orgId))).toEqual([]);
    });
  });

  it("returns nothing when no tenant is set", async () => {
    expect(await raw`select * from quotes`).toHaveLength(0);
    expect(await raw`select * from organizations`).toHaveLength(0);
    await raw.begin(async (tx) => {
      await tx`select set_config('app.org_id', '', true)`;
      expect(await tx`select * from clients`).toHaveLength(0);
    });
  });

  it("doesn't leak the tenant to the next transaction on the same connection", async () => {
    await raw.begin(async (tx) => {
      await tx`select set_config('app.org_id', ${a.orgId}, true)`;
      expect(await tx`select id from quotes`).toHaveLength(1);
    });
    expect(await raw`select id from quotes`).toHaveLength(0);
  });
});

describe("writes", () => {
  it("can't insert rows into another tenant", async () => {
    const code = await pgError(withTenant(a.orgId, (tx) => tx.insert(clients).values({ orgId: b.orgId, name: "Planted" })));
    expect(code).toBe(INSUFFICIENT_PRIVILEGE);
  });

  it("can't update or delete another tenant's rows", async () => {
    await withTenant(a.orgId, async (tx) => {
      expect(await tx.update(quotes).set({ title: "Hacked" }).where(eq(quotes.id, b.quoteId)).returning()).toEqual([]);
      expect(await tx.delete(quoteLines).where(eq(quoteLines.id, b.lineId)).returning()).toEqual([]);
      expect(await tx.update(organizations).set({ name: "Hacked" }).where(eq(organizations.id, b.orgId)).returning()).toEqual([]);
    });
    await withTenant(b.orgId, async (tx) => {
      const [quote] = await tx.select().from(quotes).where(eq(quotes.id, b.quoteId));
      expect(quote.title).toBe("Kitchen");
      expect(await tx.select().from(quoteLines)).toHaveLength(1);
    });
  });

  it("can't move its own rows into another tenant", async () => {
    const code = await pgError(withTenant(a.orgId, (tx) => tx.update(clients).set({ orgId: b.orgId }).where(eq(clients.id, a.clientId))));
    expect(code).toBe(INSUFFICIENT_PRIVILEGE);
  });

  it("can't create another organization", async () => {
    const other = randomUUID();
    const code = await pgError(
      withTenant(a.orgId, (tx) => tx.execute(sql`insert into organizations (id, clerk_org_id, name) values (${other}, ${clerkId(other)}, 'x')`)),
    );
    expect(code).toBe(INSUFFICIENT_PRIVILEGE);
  });

  it("can't change billing columns or delete an organization, even its own", async () => {
    // Column grants: plan and Stripe IDs belong to the billing webhooks; Clerk deletions are soft.
    for (const change of [{ plan: "pro" as const }, { stripeCustomerId: "cus_x" }, { connectAccountId: "acct_x" }]) {
      expect(await pgError(withTenant(a.orgId, (tx) => tx.update(organizations).set(change).where(eq(organizations.id, a.orgId))))).toBe(
        INSUFFICIENT_PRIVILEGE,
      );
    }
    expect(await pgError(withTenant(a.orgId, (tx) => tx.delete(organizations).where(eq(organizations.id, a.orgId))))).toBe(INSUFFICIENT_PRIVILEGE);
    expect(
      await pgError(withTenant(a.orgId, (tx) => tx.update(organizations).set({ clerkOrgId: "org_stolen" }).where(eq(organizations.id, a.orgId)))),
    ).toBe(INSUFFICIENT_PRIVILEGE);
  });
});

describe("references", () => {
  it("can't point its rows at another tenant's records", async () => {
    // Foreign-key checks bypass RLS; composite (org_id, id) keys are what stop these.
    const attempts = [
      (tx: Parameters<Parameters<typeof withTenant>[1]>[0]) =>
        tx.insert(quotes).values({ orgId: a.orgId, clientId: b.clientId, number: 9001, title: "x", markupBps: 0, vatRateBps: 0 }),
      (tx: Parameters<Parameters<typeof withTenant>[1]>[0]) =>
        tx.insert(quoteSections).values({ orgId: a.orgId, quoteId: b.quoteId, position: 1, name: "x" }),
      (tx: Parameters<Parameters<typeof withTenant>[1]>[0]) =>
        tx.insert(quoteLines).values({ orgId: a.orgId, sectionId: b.sectionId, position: 1, name: "x", qty: "1", unit: "item", ratePence: 1, markupBps: 0 }),
      (tx: Parameters<Parameters<typeof withTenant>[1]>[0]) =>
        tx.update(quoteLines).set({ serviceId: b.serviceId }).where(eq(quoteLines.id, a.lineId)),
    ];
    for (const attempt of attempts) {
      expect(await pgError(withTenant(a.orgId, attempt))).toBe(FOREIGN_KEY_VIOLATION);
    }
  });
});

describe("app role", () => {
  it("can't switch off or get around RLS", async () => {
    expect(await pgError(raw`alter table quotes disable row level security`)).toBe(INSUFFICIENT_PRIVILEGE);
    expect(await pgError(raw`alter table quotes no force row level security`)).toBe(INSUFFICIENT_PRIVILEGE);
    expect(await pgError(raw`drop policy tenant_isolation on quotes`)).toBe(INSUFFICIENT_PRIVILEGE);
    expect(await pgError(raw`truncate quotes`)).toBe(INSUFFICIENT_PRIVILEGE);
    expect(await pgError(raw`set role builderos_owner_test`)).toBe(INSUFFICIENT_PRIVILEGE);
    expect(await pgError(raw`create table public.sneaky (id int)`)).toBe(INSUFFICIENT_PRIVILEGE);
  });

  it("withTenant rejects anything that isn't a UUID", async () => {
    for (const bad of ["", "not-a-uuid", `${a.orgId}' or 1=1 --`]) {
      await expect(withTenant(bad, async () => null)).rejects.toThrow();
    }
  });

  it("withTenant refuses to run as a role that could bypass RLS", async () => {
    await closeDb();
    process.env.DATABASE_URL = ownerUrl();
    try {
      await expect(withTenant(a.orgId, async () => null)).rejects.toThrow(/builderos_app/);
    } finally {
      await closeDb();
      process.env.DATABASE_URL = appUrl();
    }
  });
});

describe("schema coverage", () => {
  it("every table has RLS enabled and forced, with a tenant policy for the app role", async () => {
    const owner = postgres(ownerUrl(), { max: 1, onnotice: () => {} });
    try {
      const tables = await owner<{ table: string; enabled: boolean; forced: boolean; policies: number }[]>`
        select c.relname as table, c.relrowsecurity as enabled, c.relforcerowsecurity as forced,
               (select count(*)::int from pg_policies p
                 where p.schemaname = 'public' and p.tablename = c.relname and 'builderos_app' = any(p.roles)) as policies
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind in ('r', 'p')
        order by 1`;
      expect(tables.length).toBeGreaterThan(0);
      for (const t of tables) expect(t, t.table).toMatchObject({ enabled: true, forced: true, policies: 1 });
    } finally {
      await owner.end();
    }
  });

  it("the owner is bound by RLS too (FORCE)", async () => {
    const owner = postgres(ownerUrl(), { max: 1, onnotice: () => {} });
    try {
      expect(await owner`select * from quotes`).toHaveLength(0);
    } finally {
      await owner.end();
    }
  });

  it("enforces limits in the database as well as in validation", async () => {
    const tooLong = "x".repeat(201);
    expect(await pgError(withTenant(a.orgId, (tx) => tx.insert(clients).values({ orgId: a.orgId, name: tooLong })))).toBe("23514");
    expect(await pgError(withTenant(a.orgId, (tx) => tx.update(quoteLines).set({ ratePence: -1 }).where(eq(quoteLines.id, a.lineId))))).toBe("23514");
    expect(
      await pgError(withTenant(a.orgId, (tx) => tx.update(organizations).set({ logoUrl: "javascript:alert(1)" }).where(eq(organizations.id, a.orgId)))),
    ).toBe("23514");
  });

  it("applies a statement timeout inside tenant transactions", async () => {
    const timeout = await withTenant(a.orgId, async (tx) => (await tx.execute<{ t: string }>(sql`select current_setting('statement_timeout') as t`))[0].t);
    expect(timeout).toBe("10s");
  });
});
