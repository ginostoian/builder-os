/** Platform metrics: activity is recorded per person per day; the dashboard reads counts across companies only. */
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { appUrl } from "@/test/db-urls";
import { applySubscription, setStripeCustomer } from "./billing";
import { closeDb, withPlatform, withTenant } from "./index";
import { companyStats, dailyActivity, recordActivity, subscriptionEventsSince, userSignups } from "./platform";

const clerkId = (uuid: string) => `org_${uuid.replaceAll("-", "")}`;
const code = (p: Promise<unknown>) =>
  p.then(
    () => "ok",
    (e: unknown) => String((e as { cause?: { code?: string } }).cause?.code ?? (e as { code?: string }).code ?? e),
  );

async function newOrg(name: string) {
  const orgId = randomUUID();
  await withTenant(orgId, (tx) => tx.execute(sql`insert into organizations (id, clerk_org_id, name) values (${orgId}, ${clerkId(orgId)}, ${name})`));
  const member = async (n: string) =>
    withTenant(orgId, async (tx) => (await tx.execute<{ id: string }>(sql`insert into members (org_id, clerk_user_id, role, name) values (${orgId}, ${"user_" + randomUUID().slice(0, 8)}, 'admin', ${n}) returning id`))[0].id);
  return { orgId, jo: await member("Jo"), sam: await member("Sam") };
}

beforeAll(() => {
  process.env.DATABASE_URL = appUrl();
});
afterAll(async () => {
  await closeDb();
});

describe("platform metrics", () => {
  it("counts views and sessions per person per day", async () => {
    const { orgId, jo, sam } = await newOrg("Metrics activity");
    const t = (hhmm: string, day = "2026-09-10") => new Date(`${day}T${hhmm}:00Z`);
    await withTenant(orgId, async (tx) => {
      await recordActivity(tx, orgId, jo, "2026-09-10", false, t("08:00"));
      await recordActivity(tx, orgId, jo, "2026-09-10", false, t("08:10"));
      await recordActivity(tx, orgId, jo, "2026-09-10", true, t("09:00"));
      await recordActivity(tx, orgId, sam, "2026-09-10", false, t("10:00"));
      await recordActivity(tx, orgId, jo, "2026-09-25", false, t("10:00", "2026-09-25"));
    });
    const [row] = await withTenant(orgId, (tx) => tx.execute<{ views: number; sessions: number; site_views: number }>(sql`select views, sessions, site_views from member_activity where member_id = ${jo} and day = '2026-09-10'`));
    expect(row).toEqual({ views: 3, sessions: 2, site_views: 1 });
    // Another company can't see it, and the app can't delete it.
    const other = await newOrg("Metrics other");
    expect(await withTenant(other.orgId, (tx) => tx.execute(sql`select 1 from member_activity where org_id = ${orgId}`))).toHaveLength(0);
    expect(await code(withTenant(orgId, (tx) => tx.execute(sql`delete from member_activity where org_id = ${orgId}`)))).toBe("42501");

    const days = await withTenant(orgId, (tx) => dailyActivity(tx, "2026-09-10", "2026-09-26"));
    expect(days).toHaveLength(17);
    const d10 = days.find((d) => d.day === "2026-09-10")!;
    expect(d10.activeUsers).toBeGreaterThanOrEqual(2);
    expect(d10.views).toBeGreaterThanOrEqual(4);
    const d25 = days.find((d) => d.day === "2026-09-25")!;
    // Jo and Sam were both active within 30 days of the 25th; only Jo within 7.
    expect(d25.mau - d25.wau).toBeGreaterThanOrEqual(1);

    const stats = await withTenant(orgId, (tx) => companyStats(tx, "2026-09-26"));
    expect(stats.find((s) => s.id === orgId)).toMatchObject({ name: "Metrics activity", users: 2, active7d: 1, active30d: 2, views30d: 5, siteViews30d: 1 });
    expect((await withTenant(orgId, (tx) => userSignups(tx, "2026-01-01"))).reduce((n, d) => n + d.users, 0)).toBeGreaterThanOrEqual(4);
  });

  it("records each change to what a company pays, and the app can't read or write that history", async () => {
    const { orgId } = await newOrg("Metrics MRR");
    const cus = `cus_${randomUUID().replaceAll("-", "")}`;
    const since = new Date(Date.now() - 1000);
    const sub = { customerId: cus, subscriptionId: `sub_${randomUUID().replaceAll("-", "")}`, plan: "essentials" as const, periodEnd: null, cancelAtPeriodEnd: false };
    await withTenant(orgId, async (tx) => {
      await setStripeCustomer(tx, orgId, cus);
      await applySubscription(tx, orgId, { ...sub, status: "active", monthlyPence: 4900 });
      // Same amount again: no new event.
      await applySubscription(tx, orgId, { ...sub, status: "active", monthlyPence: 4900 });
      await applySubscription(tx, orgId, { ...sub, plan: "pro", status: "active", monthlyPence: 11900 });
      await applySubscription(tx, orgId, { ...sub, plan: "pro", status: "canceled", monthlyPence: 11900 });
    });
    const events = (await withTenant(orgId, (tx) => subscriptionEventsSince(tx, since))).filter((e) => e.orgId === orgId);
    expect(events.map((e) => [e.before, e.after])).toEqual([
      [0, 4900],
      [4900, 11900],
      [11900, 0],
    ]);
    expect((await withTenant(orgId, (tx) => companyStats(tx, "2026-10-04"))).find((s) => s.id === orgId)?.mrrPence).toBe(0);
    expect(await code(withTenant(orgId, (tx) => tx.execute(sql`select * from subscription_events`)))).toBe("42501");
    expect(await code(withTenant(orgId, (tx) => tx.execute(sql`update organizations set mrr_pence = 1 where id = ${orgId}`)))).toBe("42501");
  });

  it("gives the owner admin area totals but no tenant rows", async () => {
    const { orgId } = await newOrg("Metrics platform");
    await withPlatform(async (tx) => {
      expect(await tx.execute(sql`select 1 from members`)).toHaveLength(0);
      expect(await tx.execute(sql`select 1 from organizations`)).toHaveLength(0);
      expect((await companyStats(tx, "2026-10-04")).find((c) => c.id === orgId)).toMatchObject({ name: "Metrics platform", users: 2 });
    });
  });
});
