/** The website estimator: settings, the public link and its lookup, and tenant isolation. */
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_ESTIMATOR } from "@/core/estimator";
import { appUrl } from "@/test/db-urls";
import { getEstimator, saveEstimatorSettings, setEstimatorLink } from "./estimator";
import { closeDb, findEstimator, withTenant } from "./index";

async function org(name: string) {
  const orgId = randomUUID();
  await withTenant(orgId, (tx) => tx.execute(sql`insert into organizations (id, clerk_org_id, name) values (${orgId}, ${"org_" + orgId.replaceAll("-", "")}, ${name})`));
  return orgId;
}

beforeAll(() => {
  process.env.DATABASE_URL = appUrl();
});
afterAll(async () => {
  await closeDb();
});

describe("website estimator", () => {
  it("starts off with the defaults, saves settings and finds its company by link", async () => {
    const a = await org("Estimates Ltd");
    const b = await org("Other Ltd");
    expect(await withTenant(a, (tx) => getEstimator(tx, a))).toEqual({ token: null, settings: DEFAULT_ESTIMATOR });

    const settings = { ...DEFAULT_ESTIMATOR, types: ["kitchen" as const, "bathroom" as const], region: "london" as const, adjustPct: 15, prices: { "kitchen:medium": 24000 }, headline: "Price your kitchen" };
    await withTenant(a, (tx) => saveEstimatorSettings(tx, a, settings));
    const token = await withTenant(a, (tx) => setEstimatorLink(tx, a, true));
    expect(token).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(await withTenant(a, (tx) => getEstimator(tx, a))).toEqual({ token, settings });
    expect(await findEstimator(token!)).toBe(a);

    // Another company can't see or change it.
    expect((await withTenant(b, (tx) => getEstimator(tx, a))).token).toBeNull();
    await withTenant(b, (tx) => saveEstimatorSettings(tx, a, DEFAULT_ESTIMATOR));
    expect((await withTenant(a, (tx) => getEstimator(tx, a))).settings).toEqual(settings);

    // A new link replaces the old one; off removes it.
    const next = await withTenant(a, (tx) => setEstimatorLink(tx, a, true));
    expect(await findEstimator(token!)).toBeNull();
    expect(await findEstimator(next!)).toBe(a);
    await withTenant(a, (tx) => setEstimatorLink(tx, a, false));
    expect(await findEstimator(next!)).toBeNull();
    expect(await findEstimator("not a token")).toBeNull();
  });

  it("falls back to the defaults when saved settings no longer fit the rules", async () => {
    const a = await org("Old Settings Ltd");
    await withTenant(a, (tx) => tx.execute(sql`update organizations set estimator = '{"types":["spaceship"]}'::jsonb where id = ${a}`));
    expect((await withTenant(a, (tx) => getEstimator(tx, a))).settings).toEqual(DEFAULT_ESTIMATOR);
  });
});
