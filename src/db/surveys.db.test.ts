/** Survey booking: settings and hours, what's on offer, client and office bookings, clashes, cancelling, reminders. */
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addDays } from "@/core/payment-plan";
import { londonToUtc } from "@/core/surveys";
import { appUrl } from "@/test/db-urls";
import { closeDb, findLeadByLink, findOrgsWithDueSurveyReminders, withTenant } from "./index";
import { listNotifications } from "./notifications";
import { createLead, getLead, setStage } from "./pipeline";
import { SurveyError, bookSurvey, cancelSurvey, claimSurveyReminder, clientBookSurvey, currentBooking, getSurveySettings, openSlots, saveSurveySettings, setSurveyHours, surveysToRemind } from "./surveys";

const clerkId = (uuid: string) => `org_${uuid.replaceAll("-", "")}`;
const reason = (p: Promise<unknown>) =>
  p.then(
    () => "ok",
    (e: unknown) => (e instanceof SurveyError ? e.reason : String((e as { cause?: { code?: string } }).cause?.code ?? e)),
  );

// Monday 5 October 2026, 08:00 UK.
const NOW = new Date("2026-10-05T07:00:00Z");
const at = (day: string, hh: number, mm = 0) => londonToUtc(day, hh * 60 + mm);

async function newOrg(name: string) {
  const orgId = randomUUID();
  await withTenant(orgId, (tx) => tx.execute(sql`insert into organizations (id, clerk_org_id, name) values (${orgId}, ${clerkId(orgId)}, ${name})`));
  const member = (role: string, who: string) =>
    withTenant(orgId, async (tx) => (await tx.execute<{ id: string }>(sql`insert into members (org_id, clerk_user_id, role, name, email) values (${orgId}, ${`user_${randomUUID()}`}, ${role}::member_role, ${who}, ${`${who.toLowerCase()}@example.com`}) returning id`))[0].id);
  const jo = await member("admin", "Jo");
  const sam = await member("estimator", "Sam");
  await withTenant(orgId, async (tx) => {
    await saveSurveySettings(tx, orgId, { enabled: true, visitMinutes: 60, bufferMinutes: 30, minNoticeHours: 0, maxDaysAhead: 3, postcodes: [] });
    // Both on Tuesdays 9 to 12.
    await setSurveyHours(tx, orgId, jo, [{ weekday: 2, startMinute: 540, endMinute: 720 }]);
    await setSurveyHours(tx, orgId, sam, [{ weekday: 2, startMinute: 540, endMinute: 720 }]);
  });
  return { orgId, jo, sam };
}

const lead = (orgId: string, name: string, memberId: string | null = null) =>
  withTenant(orgId, (tx) => createLead(tx, orgId, { name, email: `${name.split(" ")[0].toLowerCase()}@example.com`, source: "website", postcode: "LS6 2AB" }, { memberId, viaWebForm: memberId === null, today: "2026-10-05", now: NOW }));

beforeAll(() => {
  process.env.DATABASE_URL = appUrl();
});
afterAll(async () => {
  await closeDb();
});

describe("survey booking", () => {
  it("offers free times and lets a client book one, moving the lead and telling the surveyor", async () => {
    const o = await newOrg("Surveys book");
    const leadId = await lead(o.orgId, "Sarah Hale");
    const offered = await withTenant(o.orgId, (tx) => openSlots(tx, o.orgId, NOW));
    // Tuesday 9:00 to 11:00 on the half hour, each once.
    expect(offered.slots.map((s) => s.startsAt.toISOString())).toEqual(["09:00", "09:30", "10:00", "10:30", "11:00"].map((t) => at("2026-10-06", Number(t.slice(0, 2)), Number(t.slice(3))).toISOString()));

    // Not on offer: refused.
    expect(await reason(withTenant(o.orgId, (tx) => clientBookSurvey(tx, o.orgId, leadId, at("2026-10-06", 13), NOW)))).toBe("unavailable");
    const booked = await withTenant(o.orgId, (tx) => clientBookSurvey(tx, o.orgId, leadId, at("2026-10-06", 10), NOW));
    expect(booked.moved).toBe(false);
    await withTenant(o.orgId, async (tx) => {
      const l = (await getLead(tx, o.orgId, leadId))!;
      expect(l.lead.stage).toBe("site_visit");
      expect(l.lead.visitAt?.toISOString()).toBe(at("2026-10-06", 10).toISOString());
      expect(l.activity.some((a) => a.kind === "visit" && a.body.includes("booked online"))).toBe(true);
      const told = await listNotifications(tx, o.orgId, booked.memberId);
      expect(told.items[0]).toMatchObject({ kind: "survey_booked", href: `/app/pipeline/${leadId}` });
    });

    // Moving it frees the old time for them (and only them).
    const moved = await withTenant(o.orgId, (tx) => clientBookSurvey(tx, o.orgId, leadId, at("2026-10-06", 9), NOW));
    expect(moved.moved).toBe(true);
    const live = await withTenant(o.orgId, (tx) => currentBooking(tx, o.orgId, leadId));
    expect(live?.startsAt.toISOString()).toBe(at("2026-10-06", 9).toISOString());
  });

  it("never double-books a person, even when the office books by hand", async () => {
    const o = await newOrg("Surveys clash");
    const a = await lead(o.orgId, "Ann Able");
    const b = await lead(o.orgId, "Ben Baker");
    await withTenant(o.orgId, (tx) => bookSurvey(tx, o.orgId, a, { startsAt: at("2026-10-06", 10), memberId: o.jo }, o.sam));
    expect(await reason(withTenant(o.orgId, (tx) => bookSurvey(tx, o.orgId, b, { startsAt: at("2026-10-06", 10, 30), memberId: o.jo }, o.sam)))).toBe("taken");
    // Someone else can go then.
    expect(await reason(withTenant(o.orgId, (tx) => bookSurvey(tx, o.orgId, b, { startsAt: at("2026-10-06", 10, 30), memberId: o.sam }, o.sam)))).toBe("ok");
    // Now Jo is out 10:00–11:00 and Sam 10:30–11:30, with travel either side: only Sam's 9:00 is left.
    const offered = await withTenant(o.orgId, (tx) => openSlots(tx, o.orgId, NOW));
    expect(offered.slots.map((s) => [s.startsAt.toISOString(), s.memberId])).toEqual([[at("2026-10-06", 9).toISOString(), o.sam]]);
    // The database itself refuses an overlapping live booking, whatever the app does.
    const c = await lead(o.orgId, "Cal Cross");
    expect(
      await reason(withTenant(o.orgId, (tx) => tx.execute(sql`insert into survey_bookings (org_id, lead_id, member_id, starts_at, ends_at, booked_by) values (${o.orgId}, ${c}, ${o.jo}, ${at("2026-10-06", 10, 15).toISOString()}::timestamptz, ${at("2026-10-06", 11).toISOString()}::timestamptz, 'office')`))),
    ).toBe("23P01");
  });

  it("cancels: by the client (follow-up to rebook), and when a lead is lost", async () => {
    const o = await newOrg("Surveys cancel");
    const a = await lead(o.orgId, "Cath Cole");
    await withTenant(o.orgId, (tx) => clientBookSurvey(tx, o.orgId, a, at("2026-10-06", 11), NOW));
    await withTenant(o.orgId, (tx) => cancelSurvey(tx, o.orgId, a, "client", null, "2026-10-05"));
    await withTenant(o.orgId, async (tx) => {
      const l = (await getLead(tx, o.orgId, a))!;
      expect(l.lead.visitAt).toBeNull();
      expect(l.lead).toMatchObject({ nextActionOn: "2026-10-05", nextAction: "Rebook the site visit" });
      expect(await currentBooking(tx, o.orgId, a)).toBeNull();
    });
    expect(await reason(withTenant(o.orgId, (tx) => cancelSurvey(tx, o.orgId, a, "client", null)))).toBe("no_booking");

    // Stage dialog with a date books it (lead's owner goes); losing the lead frees the time.
    const b = await lead(o.orgId, "Dan Dee", o.jo);
    await withTenant(o.orgId, (tx) => setStage(tx, o.orgId, b, { stage: "site_visit", visitAt: at("2026-10-07", 15).toISOString() }, o.jo, NOW));
    expect((await withTenant(o.orgId, (tx) => currentBooking(tx, o.orgId, b)))?.memberId).toBe(o.jo);
    await withTenant(o.orgId, (tx) => setStage(tx, o.orgId, b, { stage: "lost", lostReason: "price" }, o.jo, NOW));
    expect(await withTenant(o.orgId, (tx) => currentBooking(tx, o.orgId, b))).toBeNull();
    expect(await reason(withTenant(o.orgId, (tx) => bookSurvey(tx, o.orgId, b, { startsAt: at("2026-10-07", 15), memberId: o.jo }, o.jo)))).toBe("closed");
  });

  it("reminds the day before, once", async () => {
    const o = await newOrg("Surveys remind");
    const a = await lead(o.orgId, "Eve East");
    await withTenant(o.orgId, (tx) => clientBookSurvey(tx, o.orgId, a, at("2026-10-06", 9), NOW));
    const from = londonToUtc(addDays("2026-10-05", 1), 0);
    const to = londonToUtc(addDays("2026-10-05", 2), 0);
    expect(await findOrgsWithDueSurveyReminders(from, to)).toContain(o.orgId);
    const due = await withTenant(o.orgId, (tx) => surveysToRemind(tx, o.orgId, from, to));
    expect(due.map((d) => d.name)).toEqual(["Eve East"]);
    expect(await withTenant(o.orgId, (tx) => claimSurveyReminder(tx, o.orgId, due[0].id))).toBe(true);
    expect(await withTenant(o.orgId, (tx) => claimSurveyReminder(tx, o.orgId, due[0].id))).toBe(false);
    expect(await withTenant(o.orgId, (tx) => surveysToRemind(tx, o.orgId, from, to))).toEqual([]);
    // The lead's private link finds them.
    const token = (await withTenant(o.orgId, (tx) => getLead(tx, o.orgId, a)))!.lead.unsubscribeToken;
    expect(await findLeadByLink(token)).toEqual({ orgId: o.orgId, leadId: a });
  });

  it("keeps each company's diary to itself, and defaults to off", async () => {
    const a = await newOrg("Surveys A");
    const b = await newOrg("Surveys B");
    const leadA = await lead(a.orgId, "Fay Fox");
    await withTenant(a.orgId, (tx) => clientBookSurvey(tx, a.orgId, leadA, at("2026-10-06", 9), NOW));
    expect(await withTenant(b.orgId, async (tx) => (await tx.execute(sql`select id from survey_bookings`)).length)).toBe(0);
    // B's surveyors are free at the same time.
    expect((await withTenant(b.orgId, (tx) => openSlots(tx, b.orgId, NOW))).slots.length).toBe(5);
    // A's people can't be given B's hours.
    expect(await reason(withTenant(b.orgId, (tx) => setSurveyHours(tx, b.orgId, a.jo, [{ weekday: 1, startMinute: 540, endMinute: 600 }])))).toBe("unknown_member");
    const fresh = randomUUID();
    await withTenant(fresh, (tx) => tx.execute(sql`insert into organizations (id, clerk_org_id, name) values (${fresh}, ${clerkId(fresh)}, 'Fresh')`));
    expect((await withTenant(fresh, (tx) => getSurveySettings(tx, fresh))).enabled).toBe(false);
    expect((await withTenant(fresh, (tx) => openSlots(tx, fresh, NOW))).slots).toEqual([]);
  });
});
