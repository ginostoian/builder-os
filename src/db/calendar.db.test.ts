/** The calendar: surveys at UK times, task start and due dates, job dates, and the per-person filter. */
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { appUrl } from "@/test/db-urls";
import { calendarItems } from "./calendar";
import { createClient } from "./clients";
import { closeDb, withTenant } from "./index";
import { createLead } from "./pipeline";
import { addTask, createProject } from "./projects";
import { createWorker } from "./team";

const clerkId = (uuid: string) => `org_${uuid.replaceAll("-", "")}`;

beforeAll(() => {
  process.env.DATABASE_URL = appUrl();
});
afterAll(async () => {
  await closeDb();
});

describe("calendar", () => {
  it("lays out surveys, tasks and job dates by UK day", async () => {
    const orgId = randomUUID();
    await withTenant(orgId, (tx) => tx.execute(sql`insert into organizations (id, clerk_org_id, name) values (${orgId}, ${clerkId(orgId)}, 'Cal')`));
    const memberId = await withTenant(orgId, async (tx) => (await tx.execute<{ id: string }>(sql`insert into members (org_id, clerk_user_id, role, name) values (${orgId}, ${"user_" + orgId.slice(0, 8)}, 'admin', 'Jo') returning id`))[0].id);
    const { dave, sam } = await withTenant(orgId, async (tx) => {
      const leadId = await createLead(tx, orgId, { name: "Sarah Hale", source: "referral", postcode: "LS6 2AB" }, { memberId, today: "2026-10-05", now: new Date("2026-10-05T10:00:00Z") });
      // 23:30 UTC on the 13th is 00:30 on the 14th in London (BST).
      await tx.execute(sql`update leads set visit_at = '2026-10-13T23:30:00Z' where id = ${leadId}`);
      const clientId = await createClient(tx, orgId, { name: "Sarah Hale" });
      const projectId = await createProject(tx, orgId, { name: "Hale kitchen", clientId, status: "booked", shareProgress: false, startDate: "2026-10-12", endDate: "2026-11-20" }, memberId);
      const dave = await createWorker(tx, orgId, { name: "Dave", kind: "employee" });
      const sam = await createWorker(tx, orgId, { name: "Sam", kind: "employee" });
      await addTask(tx, orgId, { projectId, title: "Strip out", status: "todo", workerId: dave, startDate: "2026-10-12", dueDate: "2026-10-14" }, memberId);
      await addTask(tx, orgId, { projectId, title: "Skip", status: "done", workerId: sam, dueDate: "2026-10-12" }, memberId);
      await addTask(tx, orgId, { projectId, title: "Undated", status: "todo" }, memberId);
      return { dave, sam };
    });

    const all = await withTenant(orgId, (tx) => calendarItems(tx, orgId, "2026-10-12", "2026-10-18", { leads: true }));
    expect(all.map((i) => `${i.day} ${i.kind} ${i.time ?? ""}${i.end ? `${i.end} ` : ""}${i.title}`)).toEqual([
      "2026-10-12 job_start Job starts: Hale kitchen",
      "2026-10-12 task start Strip out",
      "2026-10-12 task Skip",
      "2026-10-14 visit 00:30Survey: Sarah Hale",
      "2026-10-14 task due Strip out",
    ]);
    // Without the pipeline permission, no surveys.
    expect((await withTenant(orgId, (tx) => calendarItems(tx, orgId, "2026-10-12", "2026-10-18", { leads: false }))).some((i) => i.kind === "visit")).toBe(false);
    // One person: only their tasks.
    const mine = await withTenant(orgId, (tx) => calendarItems(tx, orgId, "2026-10-12", "2026-10-18", { leads: true, workerId: sam }));
    expect(mine.map((i) => i.title)).toEqual(["Skip"]);
    expect(dave).toBeTruthy();
    // The finish date shows in its own week.
    expect((await withTenant(orgId, (tx) => calendarItems(tx, orgId, "2026-11-16", "2026-11-22", { leads: true }))).map((i) => i.title)).toEqual(["Due to finish: Hale kitchen"]);
  });
});
