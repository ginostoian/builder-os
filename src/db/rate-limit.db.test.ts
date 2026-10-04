/** Rate limits: counted outside any tenant, in fixed windows; invisible inside a tenant. */
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { appUrl } from "@/test/db-urls";
import { closeDb, hitRateLimit, sweepRateLimits, withTenant } from "./index";

const key = () => `test_bucket:${randomUUID().replaceAll("-", "")}${randomUUID().replaceAll("-", "")}`;

beforeAll(() => {
  process.env.DATABASE_URL = appUrl();
});
afterAll(async () => {
  await closeDb();
});

describe("rate limits", () => {
  it("counts hits in a window and refuses past the limit", async () => {
    const k = key();
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await hitRateLimit(k, 3, 60));
    expect(results.map((r) => r.allowed)).toEqual([true, true, true, false]);
    expect(results[3].hits).toBe(4);
  });

  it("starts a new window once the old one has passed", async () => {
    const k = key();
    await hitRateLimit(k, 1, 1);
    expect((await hitRateLimit(k, 1, 1)).allowed).toBe(false);
    await new Promise((r) => setTimeout(r, 1_200));
    expect(await hitRateLimit(k, 1, 1)).toEqual({ allowed: true, hits: 1 });
    expect(await sweepRateLimits()).toBeGreaterThanOrEqual(0);
  });

  it("isn't visible or writable inside a tenant, and keys must be hashes", async () => {
    const orgId = randomUUID();
    expect(await withTenant(orgId, (tx) => tx.execute(sql`select * from rate_limits`))).toHaveLength(0);
    await expect(withTenant(orgId, (tx) => tx.execute(sql`insert into rate_limits (key) values (${key()})`))).rejects.toThrow();
    await expect(hitRateLimit("enquiry_ip:203.0.113.9", 5, 60)).rejects.toThrow();
  });
});
