/** The bell (who hears about what, read and unread, one company's never shown to another) and ⌘K search. */
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { appUrl } from "@/test/db-urls";
import { createClient } from "./clients";
import { closeDb, withTenant } from "./index";
import { listNotifications, markRead, membersWithRoles, notify } from "./notifications";
import { createLead, updateLead } from "./pipeline";
import { addTask, createProject, updateTask } from "./projects";
import { parseRef, search } from "./search";
import { createWorker, linkWorker } from "./team";

const TODAY = "2026-10-05";
const NOW = new Date("2026-10-05T10:00:00Z");
const clerkId = (uuid: string) => `org_${uuid.replaceAll("-", "")}`;

async function newOrg(name: string) {
  const orgId = randomUUID();
  await withTenant(orgId, (tx) => tx.execute(sql`insert into organizations (id, clerk_org_id, name) values (${orgId}, ${clerkId(orgId)}, ${name})`));
  const member = (role: string, who: string) =>
    withTenant(orgId, async (tx) => (await tx.execute<{ id: string }>(sql`insert into members (org_id, clerk_user_id, role, name) values (${orgId}, ${`user_${randomUUID()}`}, ${role}::member_role, ${who}) returning id`))[0].id);
  return { orgId, admin: await member("admin", "Jo"), office: await member("office", "Ann"), estimator: await member("estimator", "Est"), employee: await member("employee", "Dave") };
}

const titles = (orgId: string, memberId: string) => withTenant(orgId, async (tx) => (await listNotifications(tx, orgId, memberId)).items.map((n) => n.title));

beforeAll(() => {
  process.env.DATABASE_URL = appUrl();
});
afterAll(async () => {
  await closeDb();
});

describe("notifications", () => {
  it("tells admins and the office about web enquiries, and owners about leads given to them", async () => {
    const o = await newOrg("Bell leads");
    await withTenant(o.orgId, (tx) => createLead(tx, o.orgId, { name: "Web Person", source: "website" }, { memberId: null, viaWebForm: true, today: TODAY, now: NOW }));
    expect(await titles(o.orgId, o.admin)).toEqual(["New enquiry from Web Person"]);
    expect(await titles(o.orgId, o.office)).toEqual(["New enquiry from Web Person"]);
    expect(await titles(o.orgId, o.estimator)).toEqual([]);

    // Adding a lead for yourself is no news; handing one to someone else is.
    const mine = await withTenant(o.orgId, (tx) => createLead(tx, o.orgId, { name: "Mine", source: "referral", ownerMemberId: o.admin }, { memberId: o.admin, today: TODAY, now: NOW }));
    expect(await titles(o.orgId, o.admin)).toHaveLength(1);
    await withTenant(o.orgId, (tx) => updateLead(tx, o.orgId, mine, { name: "Mine", source: "referral", ownerMemberId: o.estimator }, o.admin));
    expect((await titles(o.orgId, o.estimator)).length).toBe(1);
    // Saving again without changing the owner doesn't repeat it.
    await withTenant(o.orgId, (tx) => updateLead(tx, o.orgId, mine, { name: "Mine", source: "referral", ownerMemberId: o.estimator, projectType: "Loft" }, o.admin));
    expect((await titles(o.orgId, o.estimator)).length).toBe(1);
  });

  it("tells a worker with a login about tasks given to them, linking employees to the site app", async () => {
    const o = await newOrg("Bell tasks");
    const { projectId, workerId } = await withTenant(o.orgId, async (tx) => {
      const clientId = await createClient(tx, o.orgId, { name: "Sarah Hale" });
      const projectId = await createProject(tx, o.orgId, { name: "Hale kitchen", clientId, status: "booked", shareProgress: false }, o.admin);
      const workerId = await createWorker(tx, o.orgId, { name: "Dave", kind: "employee" });
      await linkWorker(tx, o.orgId, workerId, o.employee);
      return { projectId, workerId };
    });
    const taskId = await withTenant(o.orgId, (tx) => addTask(tx, o.orgId, { projectId, title: "Strip out", status: "todo", workerId }, o.admin));
    const first = await withTenant(o.orgId, (tx) => listNotifications(tx, o.orgId, o.employee));
    expect(first.unread).toBe(1);
    expect(first.items[0]).toMatchObject({ kind: "task_assigned", title: "New task: Strip out", body: "Hale kitchen", href: `/m/jobs/${projectId}` });

    // Same worker again: nothing new. Unassigned and given back: tells them again.
    await withTenant(o.orgId, (tx) => updateTask(tx, o.orgId, taskId, { projectId, title: "Strip out", status: "in_progress", workerId }, o.admin));
    expect(await titles(o.orgId, o.employee)).toHaveLength(1);
    await withTenant(o.orgId, (tx) => updateTask(tx, o.orgId, taskId, { projectId, title: "Strip out", status: "in_progress" }, o.admin));
    await withTenant(o.orgId, (tx) => updateTask(tx, o.orgId, taskId, { projectId, title: "Strip out", status: "in_progress", workerId }, o.admin));
    expect(await titles(o.orgId, o.employee)).toHaveLength(2);
  });

  it("marks one or all read, skips inactive members, and keeps each company's to itself", async () => {
    const a = await newOrg("Bell A");
    const b = await newOrg("Bell B");
    await withTenant(a.orgId, async (tx) => {
      await tx.execute(sql`update members set active = false where id = ${a.estimator}`);
      expect((await membersWithRoles(tx, a.orgId, ["admin", "estimator"])).sort()).toEqual([a.admin]);
      await notify(tx, a.orgId, [a.admin, a.admin, a.office, a.estimator, b.admin], { kind: "quote_opened", title: "One", href: "/app/quotes" });
      await notify(tx, a.orgId, [a.admin, a.office], { kind: "quote_comment", title: "Two", href: "/app/quotes" }, a.office);
    });
    expect(await titles(a.orgId, a.admin)).toEqual(["Two", "One"]);
    expect(await titles(a.orgId, a.office)).toEqual(["One"]);
    expect(await titles(a.orgId, a.estimator)).toEqual([]);
    expect(await titles(b.orgId, b.admin)).toEqual([]);
    // Company B can't see or mark A's notifications, even by id.
    const [one] = await withTenant(a.orgId, async (tx) => (await listNotifications(tx, a.orgId, a.admin)).items);
    await withTenant(b.orgId, (tx) => markRead(tx, b.orgId, b.admin, one.id));
    expect(await withTenant(b.orgId, async (tx) => (await tx.execute(sql`select id from notifications`)).length)).toBe(0);

    await withTenant(a.orgId, (tx) => markRead(tx, a.orgId, a.admin, one.id));
    expect((await withTenant(a.orgId, (tx) => listNotifications(tx, a.orgId, a.admin))).unread).toBe(1);
    // Someone else can't mark mine.
    await withTenant(a.orgId, (tx) => markRead(tx, a.orgId, a.office, null));
    expect((await withTenant(a.orgId, (tx) => listNotifications(tx, a.orgId, a.admin))).unread).toBe(1);
    await withTenant(a.orgId, (tx) => markRead(tx, a.orgId, a.admin, null));
    expect((await withTenant(a.orgId, (tx) => listNotifications(tx, a.orgId, a.admin))).unread).toBe(0);
  });

  it("refuses links that leave the app", async () => {
    const o = await newOrg("Bell links");
    const bad = (href: string) =>
      withTenant(o.orgId, (tx) => notify(tx, o.orgId, [o.admin], { kind: "enquiry", title: "x", href })).then(
        () => "ok",
        (e: unknown) => String((e as { cause?: { code?: string } }).cause?.code ?? e),
      );
    expect(await bad("https://evil.example")).toBe("23514");
    expect(await bad("//evil.example")).toBe("23514");
    expect(await bad("/app")).toBe("ok");
  });
});

describe("search", () => {
  it("reads quote, invoice and PO numbers", () => {
    expect(parseRef("Q-0012")).toEqual({ prefix: "q", n: 12 });
    expect(parseRef("inv 7")).toEqual({ prefix: "inv", n: 7 });
    expect(parseRef("#42")).toEqual({ prefix: null, n: 42 });
    expect(parseRef("kitchen")).toBeNull();
  });

  it("finds by name and address, only what the role may see, and only in this company", async () => {
    const a = await newOrg("Search A");
    const b = await newOrg("Search B");
    await withTenant(a.orgId, async (tx) => {
      const clientId = await createClient(tx, a.orgId, { name: "Sarah Hale", address: { line1: "12 Elm Road", town: "Leeds", postcode: "LS6 2AB" } });
      await createProject(tx, a.orgId, { name: "Hale kitchen", clientId, status: "booked", shareProgress: false }, a.admin);
      await createWorker(tx, a.orgId, { name: "Halef Builder", kind: "subcontractor" });
    });
    await withTenant(b.orgId, (tx) => createClient(tx, b.orgId, { name: "Hale Other" }));

    const kinds = (orgId: string, role: Parameters<typeof search>[2], q: string) => withTenant(orgId, async (tx) => (await search(tx, orgId, role, q)).map((h) => `${h.kind}:${h.title}`));
    expect(await kinds(a.orgId, "admin", "hale")).toEqual(["client:Sarah Hale", "project:Hale kitchen", "person:Halef Builder"]);
    expect(await kinds(a.orgId, "admin", "elm road")).toEqual(["client:Sarah Hale"]);
    // Address keys aren't searchable text.
    expect(await kinds(a.orgId, "admin", "postcode")).toEqual([]);
    // % is literal, not a wildcard.
    expect(await kinds(a.orgId, "admin", "%")).toEqual([]);
    // An employee sees nothing here.
    expect(await kinds(a.orgId, "employee", "hale")).toEqual([]);
    expect(await kinds(a.orgId, "site_lead", "hale")).toEqual(["client:Sarah Hale", "project:Hale kitchen", "person:Halef Builder"]);
    expect(await kinds(b.orgId, "admin", "hale")).toEqual(["client:Hale Other"]);
  });
});
