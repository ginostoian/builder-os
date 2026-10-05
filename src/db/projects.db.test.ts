/** Projects: starting from a quote, stages and tasks, the diary, files, the portal view and isolation. */
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { QuoteLineInput, TaskInput } from "@/core/schemas";
import { appUrl } from "@/test/db-urls";
import { createClient } from "./clients";
import { closeDb, withTenant } from "./index";
import { decide } from "./portal";
import {
  ProjectError,
  addDiaryEntry,
  addDiaryPhoto,
  addFile,
  addPhase,
  addTask,
  createProject,
  createProjectFromQuote,
  deleteDiaryEntry,
  deleteFile,
  deletePhase,
  deleteProject,
  getProject,
  listDiary,
  listFiles,
  listProjects,
  movePhase,
  moveTask,
  portalProject,
  portalProjects,
  projectMoney,
  setDiaryShared,
  setFileShared,
  setTaskStatus,
  updateProject,
  updateTask,
} from "./projects";
import { createQuote, getQuote, saveQuote } from "./quotes";
import { createWorker } from "./team";
import { sendQuote } from "./sending";

const TODAY = "2026-10-04";
const clerkId = (uuid: string) => `org_${uuid.replaceAll("-", "")}`;
const qline = (name: string): QuoteLineInput => ({ name, qty: 1, unit: "job", ratePence: 10_000, markupBps: 0, noteVisible: false, kind: "normal" });
const reason = (p: Promise<unknown>) =>
  p.then(
    () => "ok",
    (e: unknown) => (e instanceof ProjectError ? e.reason : String((e as { cause?: { code?: string } }).cause?.code ?? e)),
  );

async function newOrg(name: string) {
  const orgId = randomUUID();
  await withTenant(orgId, (tx) => tx.execute(sql`insert into organizations (id, clerk_org_id, name) values (${orgId}, ${clerkId(orgId)}, ${name})`));
  const memberId = await withTenant(orgId, async (tx) => (await tx.execute<{ id: string }>(sql`insert into members (org_id, clerk_user_id, role, name) values (${orgId}, ${"user_" + orgId.slice(0, 8)}, 'admin', 'Jo') returning id`))[0].id);
  const workerId = await withTenant(orgId, (tx) => createWorker(tx, orgId, { name: "Jo", kind: "employee" }));
  return { orgId, memberId, workerId };
}

/** A two-section quote, sent and (optionally) accepted. */
async function quote(orgId: string, memberId: string, accept = true) {
  return withTenant(orgId, async (tx) => {
    const clientId = await createClient(tx, orgId, { name: "Sarah Hale", email: "sarah@example.com", address: { line1: "14 Elm Road", town: "London", postcode: "N1 7AA" } });
    const quoteId = await createQuote(tx, orgId, { clientId, title: "Kitchen extension" });
    const q = (await getQuote(tx, orgId, quoteId))!;
    const second = randomUUID();
    await saveQuote(tx, orgId, {
      quoteId,
      baseVersion: 0,
      ops: [
        { op: "renameSection", sectionId: q.sections[0].id, name: "Strip out" },
        { op: "addLine", sectionId: q.sections[0].id, lineId: randomUUID(), position: 0, line: qline("Remove old units") },
        { op: "addLine", sectionId: q.sections[0].id, lineId: randomUUID(), position: 1, line: qline("Skip hire") },
        { op: "addSection", sectionId: second, name: "First fix", position: 1 },
        { op: "addLine", sectionId: second, lineId: randomUUID(), position: 0, line: qline("Electrics first fix") },
      ],
    });
    await sendQuote(tx, orgId, { quoteId, baseVersion: (await getQuote(tx, orgId, quoteId))!.quote.version, memberId });
    if (accept) await decide(tx, orgId, clientId, q.quote.number, { decision: "accepted", fullName: "Sarah Hale", signature: "Sarah Hale", agree: true }, { ip: null, userAgent: null });
    return { clientId, quoteId };
  });
}

const task = (projectId: string, over: Partial<TaskInput> = {}): TaskInput => ({ projectId, title: "Tile splashback", status: "todo", ...over });

beforeAll(() => {
  process.env.DATABASE_URL = appUrl();
});
afterAll(async () => {
  await closeDb();
});

describe("starting projects", () => {
  it("builds stages and tasks from the accepted quote, once", async () => {
    const { orgId, memberId } = await newOrg("Proj start");
    const pending = await quote(orgId, memberId, false);
    expect(await reason(withTenant(orgId, (tx) => createProjectFromQuote(tx, orgId, { quoteId: pending.quoteId, tasksFromLines: true }, memberId)))).toBe("not_accepted");

    const { quoteId } = await quote(orgId, memberId);
    const id = await withTenant(orgId, (tx) => createProjectFromQuote(tx, orgId, { quoteId, tasksFromLines: true, startDate: "2026-10-12" }, memberId));
    await withTenant(orgId, async (tx) => {
      const p = (await getProject(tx, orgId, id))!;
      expect(p.project).toMatchObject({ name: "Kitchen extension", status: "booked", startDate: "2026-10-12", siteAddress: { line1: "14 Elm Road" } });
      expect(p.phases.map((ph) => ph.name)).toEqual(["Strip out", "First fix"]);
      expect(p.tasks.map((t) => [t.title, p.phases.find((ph) => ph.id === t.phaseId)?.name])).toEqual([
        ["Remove old units", "Strip out"],
        ["Skip hire", "Strip out"],
        ["Electrics first fix", "First fix"],
      ]);
    });
    const again = await withTenant(orgId, (tx) => createProjectFromQuote(tx, orgId, { quoteId, tasksFromLines: false }, memberId)).catch((e: unknown) => e);
    expect(again).toBeInstanceOf(ProjectError);
    expect(again).toMatchObject({ reason: "exists", projectId: id });
  });

  it("can start a project without a quote, for a client of this company only", async () => {
    const a = await newOrg("Proj manual");
    const b = await newOrg("Proj other");
    const clientId = await withTenant(a.orgId, (tx) => createClient(tx, a.orgId, { name: "Tom" }));
    const otherClient = await withTenant(b.orgId, (tx) => createClient(tx, b.orgId, { name: "Not yours" }));
    const base = { name: "Garden wall", status: "on_site" as const, shareProgress: true };
    expect(await reason(withTenant(a.orgId, (tx) => createProject(tx, a.orgId, { ...base, clientId: otherClient }, a.memberId)))).toBe("unknown_client");
    const id = await withTenant(a.orgId, (tx) => createProject(tx, a.orgId, { ...base, clientId, managerMemberId: a.memberId }, a.memberId));
    await withTenant(a.orgId, (tx) => updateProject(tx, a.orgId, id, { ...base, clientId, status: "complete" }));
    await withTenant(a.orgId, async (tx) => {
      const p = (await getProject(tx, a.orgId, id))!.project;
      expect(p.status).toBe("complete");
      expect(p.completedAt).not.toBeNull();
      expect(p.managerMemberId).toBeNull();
      expect((await listProjects(tx, a.orgId, "complete", TODAY)).map((r) => r.id)).toEqual([id]);
      expect(await listProjects(tx, a.orgId, "active", TODAY)).toEqual([]);
    });
  });
});

describe("stages and tasks", () => {
  it("adds, edits, moves and completes tasks, and keeps them when a stage goes", async () => {
    const { orgId, memberId, workerId } = await newOrg("Proj tasks");
    const { quoteId } = await quote(orgId, memberId);
    const id = await withTenant(orgId, (tx) => createProjectFromQuote(tx, orgId, { quoteId, tasksFromLines: false }, memberId));
    const q2 = await quote(orgId, memberId);
    const other = await withTenant(orgId, (tx) => createProjectFromQuote(tx, orgId, { quoteId: q2.quoteId, tasksFromLines: false }, memberId));
    await withTenant(orgId, async (tx) => {
      const p = (await getProject(tx, orgId, id))!;
      const [strip, first] = p.phases;
      const otherPhase = (await getProject(tx, orgId, other))!.phases[0];
      // A stage from another project is refused (and the database would refuse it too).
      expect(await reason(addTask(tx, orgId, task(id, { phaseId: otherPhase.id }), memberId))).toBe("unknown_phase");

      const a = await addTask(tx, orgId, task(id, { phaseId: strip.id, title: "Rip out", dueDate: "2026-10-01" }), memberId);
      const b = await addTask(tx, orgId, task(id, { phaseId: strip.id, title: "Skip", status: "waiting" }), memberId);
      const c = await addTask(tx, orgId, task(id, { phaseId: first.id, title: "Cables" }), memberId);
      await updateTask(tx, orgId, c, task(id, { phaseId: first.id, title: "Cables and back boxes", trade: "Electrician", startDate: "2026-10-05", dueDate: "2026-10-07", workerId }));

      await setTaskStatus(tx, orgId, id, a, "done");
      // (Dates out of order are refused by the database too; see below, in its own transaction.)
      // Drag "Cables" into Waiting, above "Skip".
      await moveTask(tx, orgId, { projectId: id, taskId: c, status: "waiting", order: [c, b] });
      const after = (await getProject(tx, orgId, id))!;
      const byId = new Map(after.tasks.map((t) => [t.id, t]));
      expect(byId.get(a)!.completedAt).not.toBeNull();
      expect(byId.get(c)).toMatchObject({ status: "waiting", trade: "Electrician", workerName: "Jo", dueDate: "2026-10-07" });
      expect(after.tasks.filter((t) => t.status === "waiting").map((t) => t.id)).toEqual([c, b]);
      await setTaskStatus(tx, orgId, id, a, "todo");
      expect((await getProject(tx, orgId, id))!.tasks.find((t) => t.id === a)!.completedAt).toBeNull();

      const [row] = await listProjects(tx, orgId, "active", TODAY).then((r) => r.filter((x) => x.id === id));
      expect(row).toMatchObject({ total: 3, done: 0, waiting: 2, late: 1 });

      // Stages: add, reorder, delete (its tasks stay, without a stage).
      const snag = await addPhase(tx, orgId, id, "Snagging");
      await movePhase(tx, orgId, id, snag, -1);
      expect((await getProject(tx, orgId, id))!.phases.map((ph) => ph.name)).toEqual(["Strip out", "Snagging", "First fix"]);
      await deletePhase(tx, orgId, id, first.id);
      expect((await getProject(tx, orgId, id))!.tasks.find((t) => t.id === c)!.phaseId).toBeNull();
    });
  });
});

describe("database checks", () => {
  it("refuses a task due before it starts, even past the app's own validation", async () => {
    const { orgId, memberId } = await newOrg("Proj checks");
    const id = await withTenant(orgId, async (tx) => createProject(tx, orgId, { name: "Wall", clientId: await createClient(tx, orgId, { name: "T" }), status: "booked", shareProgress: true }, memberId));
    expect(await reason(withTenant(orgId, (tx) => addTask(tx, orgId, task(id, { startDate: "2026-10-07", dueDate: "2026-10-05" }), memberId)))).toBe("23514");
  });
});

describe("diary, files and the client portal", () => {
  it("shows the client progress and only what's shared, and only their own project", async () => {
    const { orgId, memberId } = await newOrg("Proj portal");
    const { quoteId, clientId } = await quote(orgId, memberId);
    const id = await withTenant(orgId, (tx) => createProjectFromQuote(tx, orgId, { quoteId, tasksFromLines: true }, memberId));
    const otherClient = await withTenant(orgId, (tx) => createClient(tx, orgId, { name: "Someone else" }));
    await withTenant(orgId, async (tx) => {
      const p = (await getProject(tx, orgId, id))!;
      await setTaskStatus(tx, orgId, id, p.tasks[0].id, "done");
      const shared = await addDiaryEntry(tx, orgId, { projectId: id, entryDate: "2026-10-05", body: "Kitchen stripped out.", weather: "rain", shareWithClient: true }, memberId);
      const internal = await addDiaryEntry(tx, orgId, { projectId: id, entryDate: "2026-10-05", body: "Neighbour complained about the skip.", shareWithClient: false }, memberId);
      for (let i = 0; i < 12; i++) await addDiaryPhoto(tx, orgId, id, shared, `orgs/${orgId}/photos/${"d".repeat(20)}${i}.jpg`);
      expect(await reason(addDiaryPhoto(tx, orgId, id, shared, "x"))).toBe("too_many_photos");
      // From the site app: only the member's own entry the client can't see yet.
      expect(await reason(addDiaryPhoto(tx, orgId, id, internal, `orgs/${orgId}/photos/${"s".repeat(20)}.jpg`, { memberId: randomUUID() }))).toBe("not_found");
      await addDiaryPhoto(tx, orgId, id, internal, `orgs/${orgId}/photos/${"s".repeat(20)}.jpg`, { memberId });
      await setDiaryShared(tx, orgId, id, internal, true);
      expect(await reason(addDiaryPhoto(tx, orgId, id, internal, `orgs/${orgId}/photos/${"t".repeat(20)}.jpg`, { memberId }))).toBe("not_found");
      await setDiaryShared(tx, orgId, id, internal, false);
      const plan = await addFile(tx, orgId, { projectId: id, name: "Kitchen plan.pdf", storageKey: `orgs/${orgId}/files/${"f".repeat(20)}.pdf`, contentType: "application/pdf", sizeBytes: 1234, memberId });
      await addFile(tx, orgId, { projectId: id, name: "Costings.pdf", storageKey: `orgs/${orgId}/files/${"g".repeat(20)}.pdf`, contentType: "application/pdf", sizeBytes: 99, memberId });
      await setFileShared(tx, orgId, id, plan, true);

      const view = (await portalProject(tx, orgId, clientId, id))!;
      expect(view.phases.map((ph) => [ph.name, ph.done, ph.total])).toEqual([
        ["Strip out", 1, 2],
        ["First fix", 0, 1],
      ]);
      expect(view.diary.map((d) => d.body)).toEqual(["Kitchen stripped out."]);
      expect(view.diary[0].photos).toHaveLength(12);
      expect(view.files.map((f) => f.name)).toEqual(["Kitchen plan.pdf"]);
      expect(JSON.stringify(view)).not.toContain("Neighbour");
      expect(await portalProject(tx, orgId, otherClient, id)).toBeUndefined();
      expect((await portalProjects(tx, orgId, clientId)).map((x) => [x.name, x.done, x.total])).toEqual([["Kitchen extension", 1, 3]]);

      // Not shared at all: the client sees nothing.
      await updateProject(tx, orgId, id, { name: "Kitchen extension", clientId, status: "on_site", shareProgress: false });
      expect(await portalProject(tx, orgId, clientId, id)).toBeUndefined();
      expect(await portalProjects(tx, orgId, clientId)).toEqual([]);

      await setDiaryShared(tx, orgId, id, internal, true);
      expect((await listDiary(tx, orgId, id)).every((d) => d.shareWithClient)).toBe(true);
      expect(await deleteDiaryEntry(tx, orgId, id, shared)).toHaveLength(12);
      expect(await deleteFile(tx, orgId, id, plan)).toMatch(/Kitchen|files/);
      expect((await listFiles(tx, orgId, id)).map((f) => f.name)).toEqual(["Costings.pdf"]);
      expect(await projectMoney(tx, orgId, quoteId)).toMatchObject({ agreed: 36_000, contract: 36_000, invoiced: 0, paid: 0 });
      const keys = await deleteProject(tx, orgId, id);
      // Costings.pdf and the site photo on the internal entry.
      expect(keys).toHaveLength(2);
      expect(await getProject(tx, orgId, id)).toBeUndefined();
    });
  });

  it("keeps each company's projects to itself", async () => {
    const a = await newOrg("Proj iso A");
    const b = await newOrg("Proj iso B");
    const { quoteId } = await quote(a.orgId, a.memberId);
    const id = await withTenant(a.orgId, (tx) => createProjectFromQuote(tx, a.orgId, { quoteId, tasksFromLines: true }, a.memberId));
    const taskId = await withTenant(a.orgId, async (tx) => (await getProject(tx, a.orgId, id))!.tasks[0].id);
    await withTenant(b.orgId, async (tx) => {
      expect(await getProject(tx, b.orgId, id)).toBeUndefined();
      expect(await reason(setTaskStatus(tx, b.orgId, id, taskId, "done"))).toBe("not_found");
      expect(await reason(addTask(tx, b.orgId, task(id), b.memberId))).toBe("not_found");
      expect(await reason(createProjectFromQuote(tx, b.orgId, { quoteId, tasksFromLines: false }, b.memberId))).toBe("not_accepted");
      expect(await listProjects(tx, b.orgId, "all", TODAY)).toEqual([]);
    });
  });
});
