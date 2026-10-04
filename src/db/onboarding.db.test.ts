/** Getting started: steps tick off from the company's data; tour and checklist choices are per person. */
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { appUrl } from "@/test/db-urls";
import { closeDb, withTenant } from "./index";
import { changeOnboarding, onboardingState } from "./onboarding";
import { recordActivity } from "./platform";

const clerkId = (uuid: string) => `org_${uuid.replaceAll("-", "")}`;

beforeAll(() => {
  process.env.DATABASE_URL = appUrl();
});
afterAll(async () => {
  await closeDb();
});

describe("onboarding", () => {
  it("reads progress from data and keeps each person's choices", async () => {
    const orgId = randomUUID();
    await withTenant(orgId, (tx) => tx.execute(sql`insert into organizations (id, clerk_org_id, name) values (${orgId}, ${clerkId(orgId)}, 'Guide Co')`));
    const add = (name: string) =>
      withTenant(orgId, async (tx) => (await tx.execute<{ id: string }>(sql`insert into members (org_id, clerk_user_id, role, name) values (${orgId}, ${"user_" + randomUUID().slice(0, 8)}, 'admin', ${name}) returning id`))[0].id);
    const jo = await add("Jo");

    let s = await withTenant(orgId, (tx) => onboardingState(tx, orgId, jo));
    expect(s).toMatchObject({ tourAt: null, hidden: false, skipped: [] });
    expect(Object.values(s.signals).every((v) => v === false)).toBe(true);

    await withTenant(orgId, async (tx) => {
      await tx.execute(sql`update organizations set vat_number = 'GB123456789' where id = ${orgId}`);
      await recordActivity(tx, orgId, jo, "2026-10-04", true);
    });
    const sam = await add("Sam");
    s = await withTenant(orgId, (tx) => onboardingState(tx, orgId, jo));
    expect(s.signals).toMatchObject({ company_details: true, team: true, site_app: true, library: false });

    await withTenant(orgId, async (tx) => {
      await changeOnboarding(tx, orgId, jo, { op: "tour_done" });
      await changeOnboarding(tx, orgId, jo, { op: "hide" });
      await changeOnboarding(tx, orgId, jo, { op: "skip", step: "logo" });
      await changeOnboarding(tx, orgId, jo, { op: "skip", step: "logo" });
      await changeOnboarding(tx, orgId, jo, { op: "skip", step: "not_a_step" });
    });
    s = await withTenant(orgId, (tx) => onboardingState(tx, orgId, jo));
    expect(s).toMatchObject({ hidden: true, skipped: ["logo"] });
    expect(s.signals.tour).toBe(true);
    // Sam's guide is their own.
    expect(await withTenant(orgId, (tx) => onboardingState(tx, orgId, sam))).toMatchObject({ tourAt: null, hidden: false, skipped: [] });

    await withTenant(orgId, async (tx) => {
      await changeOnboarding(tx, orgId, jo, { op: "unskip", step: "logo" });
      await changeOnboarding(tx, orgId, jo, { op: "show" });
      await changeOnboarding(tx, orgId, jo, { op: "tour_reset" });
    });
    expect(await withTenant(orgId, (tx) => onboardingState(tx, orgId, jo))).toMatchObject({ tourAt: null, hidden: false, skipped: [] });
  });
});
