/** The team, certificates, the week plan, and the site app's access and check-ins, against real Postgres. */
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { appUrl } from "@/test/db-urls";
import { createClient } from "./clients";
import { closeDb, findOrgsWithExpiringCertificates, withTenant } from "./index";
import { addTask, createProject, getProject } from "./projects";
import { SiteError, checkIn, checkOut, claimSyncOp, isMyJob, myJob, myJobs, myTasks, openVisit, recordSyncResult, setMyTaskStatus, workerForMember } from "./site";
import {
  TeamError,
  addCertificate,
  certificateAlerts,
  certificateReminderContext,
  certificatesToRemind,
  createWorker,
  editVisit,
  ensureWorkerForMember,
  getWorker,
  linkWorker,
  listVisits,
  listWorkers,
  markCertificatesReminded,
  setWorkerArchived,
  teamSchedule,
  unlinkedMembers,
  updateCertificate,
} from "./team";

const TODAY = "2026-10-05";
const clerkId = (uuid: string) => `org_${uuid.replaceAll("-", "")}`;
const reason = (p: Promise<unknown>) =>
  p.then(
    () => "ok",
    (e: unknown) => (e instanceof TeamError || e instanceof SiteError ? e.reason : String((e as { cause?: { code?: string } }).cause?.code ?? e)),
  );

async function newOrg(name: string) {
  const orgId = randomUUID();
  await withTenant(orgId, (tx) => tx.execute(sql`insert into organizations (id, clerk_org_id, name) values (${orgId}, ${clerkId(orgId)}, ${name})`));
  return orgId;
}
async function member(orgId: string, name: string, email: string | null, role = "employee") {
  return withTenant(orgId, async (tx) => (await tx.execute<{ id: string }>(sql`insert into members (org_id, clerk_user_id, role, name, email) values (${orgId}, ${"user_" + randomUUID().slice(0, 8)}, ${role}, ${name}, ${email}) returning id`))[0].id);
}
async function project(orgId: string, name: string, status: "on_site" | "complete" = "on_site", managerMemberId?: string) {
  return withTenant(orgId, async (tx) => createProject(tx, orgId, { name, clientId: await createClient(tx, orgId, { name: `${name} client`, phone: "07700 900123" }), status, shareProgress: true, managerMemberId }, (await tx.execute<{ id: string }>(sql`select id from members where org_id = ${orgId} limit 1`))[0]?.id ?? (await member(orgId, "Owner", null, "admin"))));
}

beforeAll(() => {
  process.env.DATABASE_URL = appUrl();
});
afterAll(async () => {
  await closeDb();
});

describe("the team", () => {
  it("puts every login on the team, linking a worker with the same email if there is one", async () => {
    const orgId = await newOrg("Team links");
    const dave = await withTenant(orgId, (tx) => createWorker(tx, orgId, { name: "Dave Moss", kind: "employee", email: "dave@example.com", trade: "Carpenter" }));
    const daveLogin = await member(orgId, "David Moss", "DAVE@example.com");
    const amyLogin = await member(orgId, "Amy", "amy@example.com");
    await withTenant(orgId, async (tx) => {
      expect(await unlinkedMembers(tx, orgId)).toHaveLength(2);
      expect(await ensureWorkerForMember(tx, orgId, { id: daveLogin, name: "David Moss", email: "DAVE@example.com" })).toBe(dave);
      const amy = await ensureWorkerForMember(tx, orgId, { id: amyLogin, name: "Amy", email: "amy@example.com" });
      expect(await ensureWorkerForMember(tx, orgId, { id: amyLogin, name: "Amy", email: "amy@example.com" })).toBe(amy);
      expect(await unlinkedMembers(tx, orgId)).toEqual([]);
      const list = await listWorkers(tx, orgId, { today: TODAY });
      expect(list.map((w) => [w.name, Boolean(w.memberId)])).toEqual([
        ["Amy", true],
        ["Dave Moss", true],
      ]);
      // A login belongs to one worker only.
      const spare = await createWorker(tx, orgId, { name: "Spare", kind: "subcontractor" });
      expect(await reason(linkWorker(tx, orgId, spare, amyLogin))).toBe("member_taken");
      await linkWorker(tx, orgId, amy, null);
      await linkWorker(tx, orgId, spare, amyLogin);
      expect((await getWorker(tx, orgId, spare))!.memberRole).toBe("employee");
    });
  });

  it("flags certificates and reminds once per expiry date", async () => {
    const orgId = await newOrg("Team certs");
    const w = await withTenant(orgId, (tx) => createWorker(tx, orgId, { name: "Sam", kind: "employee" }));
    const cscs = await withTenant(orgId, (tx) => addCertificate(tx, orgId, w, { name: "CSCS card", expiresOn: "2026-10-20" }));
    await withTenant(orgId, (tx) => addCertificate(tx, orgId, w, { name: "Gas Safe", expiresOn: "2027-06-01" }));
    expect(await findOrgsWithExpiringCertificates("2026-11-04")).toContain(orgId);
    await member(orgId, "Ann", "ann@certs.test", "admin");
    await member(orgId, "Ed", "ed@certs.test", "employee");
    await withTenant(orgId, async (tx) => {
      expect((await certificateAlerts(tx, orgId, TODAY)).map((c) => c.name)).toEqual(["CSCS card"]);
      const due = await certificatesToRemind(tx, orgId, "2026-11-04");
      expect(due.map((c) => c.name)).toEqual(["CSCS card"]);
      await markCertificatesReminded(tx, orgId, due.map((c) => c.id));
      expect(await certificatesToRemind(tx, orgId, "2026-11-04")).toEqual([]);
      expect((await listWorkers(tx, orgId, { today: TODAY }))[0]).toMatchObject({ expiring: 1, expired: 0 });
      expect(await certificateReminderContext(tx, orgId)).toEqual({ company: "Team certs", brandColour: null, to: ["ann@certs.test"] });
    });
    expect(await findOrgsWithExpiringCertificates("2026-11-04")).not.toContain(orgId);
    // Renewed with a new date: it can be reminded about again when that comes round.
    await withTenant(orgId, (tx) => updateCertificate(tx, orgId, w, cscs, { name: "CSCS card", expiresOn: "2026-10-30" }));
    expect(await findOrgsWithExpiringCertificates("2026-11-04")).toContain(orgId);
    // Archived workers aren't reminded about.
    await withTenant(orgId, (tx) => setWorkerArchived(tx, orgId, w, true));
    expect(await findOrgsWithExpiringCertificates("2026-11-04")).not.toContain(orgId);
  });

  it("plans the week from task dates, and archiving someone frees their tasks", async () => {
    const orgId = await newOrg("Team plan");
    const p = await project(orgId, "Kitchen");
    const done = await project(orgId, "Old job", "complete");
    const [a, b] = await withTenant(orgId, async (tx) => [await createWorker(tx, orgId, { name: "Ann", kind: "employee" }), await createWorker(tx, orgId, { name: "Ben", kind: "subcontractor", trade: "Plumber" })]);
    await withTenant(orgId, async (tx) => {
      await addTask(tx, orgId, { projectId: p, title: "Mon-Wed", status: "todo", workerId: a, startDate: "2026-10-05", dueDate: "2026-10-07" }, (await getProject(tx, orgId, p))!.project.createdByMemberId!);
      await addTask(tx, orgId, { projectId: p, title: "Spans weeks", status: "in_progress", workerId: b, startDate: "2026-09-28", dueDate: "2026-10-06" }, (await getProject(tx, orgId, p))!.project.createdByMemberId!);
      await addTask(tx, orgId, { projectId: p, title: "Next week", status: "todo", workerId: a, dueDate: "2026-10-13" }, (await getProject(tx, orgId, p))!.project.createdByMemberId!);
      await addTask(tx, orgId, { projectId: done, title: "Finished job", status: "todo", workerId: a, dueDate: "2026-10-06" }, (await getProject(tx, orgId, done))!.project.createdByMemberId!);
      const week = await teamSchedule(tx, orgId, "2026-10-05");
      expect(week.team.map((w) => w.name)).toEqual(["Ann", "Ben"]);
      expect(week.tasks.map((t) => t.title).sort()).toEqual(["Mon-Wed", "Spans weeks"]);
      await setWorkerArchived(tx, orgId, a, true);
      expect((await getProject(tx, orgId, p))!.tasks.filter((t) => t.workerId === a)).toEqual([]);
      expect((await listWorkers(tx, orgId, { today: TODAY })).map((w) => w.name)).toEqual(["Ben"]);
      expect((await listWorkers(tx, orgId, { archived: true, today: TODAY })).map((w) => w.name)).toEqual(["Ann"]);
    });
  });
});

describe("the site app", () => {
  it("shows a worker only their jobs and tasks, and lets them change only their own", async () => {
    const orgId = await newOrg("Site app");
    const login = await member(orgId, "Dave", "dave@example.com");
    const leadLogin = await member(orgId, "Lou", "lou@example.com", "site_lead");
    const mine = await project(orgId, "Mine");
    const theirs = await project(orgId, "Theirs");
    const runs = await project(orgId, "Lou runs it", "on_site", leadLogin);
    await withTenant(orgId, async (tx) => {
      const me = await ensureWorkerForMember(tx, orgId, { id: login, name: "Dave", email: "dave@example.com" });
      const other = await createWorker(tx, orgId, { name: "Other", kind: "employee" });
      const lou = await ensureWorkerForMember(tx, orgId, { id: leadLogin, name: "Lou", email: "lou@example.com" });
      const by = (await getProject(tx, orgId, mine))!.project.createdByMemberId!;
      const t1 = await addTask(tx, orgId, { projectId: mine, title: "Fit doors", status: "todo", workerId: me!, dueDate: "2026-10-06" }, by);
      const t2 = await addTask(tx, orgId, { projectId: theirs, title: "Not mine", status: "todo", workerId: other }, by);
      expect((await workerForMember(tx, orgId, login))!.id).toBe(me);

      const meRef = { workerId: me!, memberId: login };
      expect((await myJobs(tx, orgId, meRef)).map((j) => j.name)).toEqual(["Mine"]);
      expect((await myTasks(tx, orgId, me!)).map((t) => t.title)).toEqual(["Fit doors"]);
      expect(await myJob(tx, orgId, meRef, theirs)).toBeUndefined();
      expect((await myJob(tx, orgId, meRef, mine))!.clientPhone).toBe("07700 900123");
      expect(await isMyJob(tx, orgId, meRef, theirs)).toBe(false);
      // The site lead sees the job they run, even without tasks on it.
      expect((await myJobs(tx, orgId, { workerId: lou!, memberId: leadLogin })).map((j) => j.name)).toEqual(["Lou runs it"]);
      expect(runs).toBeTruthy();

      expect(await reason(setMyTaskStatus(tx, orgId, me!, t2, "done", undefined, TODAY))).toBe("not_yours");
      await setMyTaskStatus(tx, orgId, me!, t1, "waiting", "doors not delivered", TODAY);
      const task = (await getProject(tx, orgId, mine))!.tasks.find((t) => t.id === t1)!;
      expect(task.status).toBe("waiting");
      expect(task.notes).toContain(`${TODAY}: waiting (doors not delivered)`);
      await setMyTaskStatus(tx, orgId, me!, t1, "done", undefined, TODAY);
      // Finished today still shows, so they can see what they've done.
      expect((await myTasks(tx, orgId, me!))[0]).toMatchObject({ title: "Fit doors", status: "done" });
    });
  });

  it("checks in to one job at a time, only their own, and builds timesheets", async () => {
    const orgId = await newOrg("Site visits");
    const login = await member(orgId, "Dave", null);
    const a = await project(orgId, "Job A");
    const b = await project(orgId, "Job B");
    const c = await project(orgId, "Not mine");
    await withTenant(orgId, async (tx) => {
      const me = (await ensureWorkerForMember(tx, orgId, { id: login, name: "Dave", email: null }))!;
      const by = (await getProject(tx, orgId, a))!.project.createdByMemberId!;
      await addTask(tx, orgId, { projectId: a, title: "A", status: "todo", workerId: me }, by);
      await addTask(tx, orgId, { projectId: b, title: "B", status: "todo", workerId: me }, by);
      const ref = { workerId: me, memberId: login };
      expect(await reason(checkIn(tx, orgId, ref, c, undefined))).toBe("not_yours");
      await checkIn(tx, orgId, ref, a, { lat: 51.5386, lng: -0.1028 });
      expect((await openVisit(tx, orgId, me))!.projectName).toBe("Job A");
      // Checking in elsewhere closes the first visit.
      await checkIn(tx, orgId, ref, b, undefined);
      expect((await openVisit(tx, orgId, me))!.projectName).toBe("Job B");
      expect(await checkOut(tx, orgId, me, undefined)).toHaveLength(1);
      expect(await openVisit(tx, orgId, me)).toBeUndefined();
      const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
      const visits = await listVisits(tx, orgId, { from: today, to: today, workerId: me });
      expect(visits.map((v) => v.projectName).sort()).toEqual(["Job A", "Job B"]);
      expect(visits.every((v) => v.checkedOutAt)).toBe(true);
      expect(visits.find((v) => v.projectName === "Job A")).toMatchObject({ inLat: "51.538600", inLng: "-0.102800", editedAt: null });
    });
  });

  it("takes check-ins sent late from a phone with no signal, at the phone's times, once", async () => {
    const orgId = await newOrg("Offline");
    const login = await member(orgId, "Sam", null);
    const other = await member(orgId, "Ola", null);
    const a = await project(orgId, "Job A");
    await withTenant(orgId, async (tx) => {
      const me = (await ensureWorkerForMember(tx, orgId, { id: login, name: "Sam", email: null }))!;
      const by = (await getProject(tx, orgId, a))!.project.createdByMemberId!;
      await addTask(tx, orgId, { projectId: a, title: "A", status: "todo", workerId: me }, by);
      const ref = { workerId: me, memberId: login };
      const inAt = new Date(Date.now() - 5 * 3_600_000);
      const outAt = new Date(Date.now() - 3_600_000);
      const op = randomUUID();
      expect(await claimSyncOp(tx, orgId, login, op)).toBeNull();
      await checkIn(tx, orgId, ref, a, undefined, { at: inAt, queued: true });
      await recordSyncResult(tx, orgId, op, a);
      // The resend is recognised (and says what the first one made); someone else can't use the id.
      expect(await claimSyncOp(tx, orgId, login, op)).toEqual({ resultId: a });
      expect(await reason(claimSyncOp(tx, orgId, other, op))).toBe("not_found");
      await checkOut(tx, orgId, me, undefined, { at: outAt, queued: true });
      const [v] = await listVisits(tx, orgId, { from: "2000-01-01", to: "2100-01-01", workerId: me });
      expect([v.checkedInAt.getTime(), v.checkedOutAt?.getTime(), v.recordedOffline]).toEqual([inAt.getTime(), outAt.getTime(), true]);
      // A check-out time before the check-in (phone clock wrong) can't make a negative visit.
      await checkIn(tx, orgId, ref, a, undefined);
      await checkOut(tx, orgId, me, undefined, { at: new Date(Date.now() - 86_400_000), queued: true });
      const visits = await listVisits(tx, orgId, { from: "2000-01-01", to: "2100-01-01", workerId: me });
      expect(visits.every((x) => x.checkedOutAt! >= x.checkedInAt)).toBe(true);
    });
  });

  it("lets the office correct a visit's times, without overlaps, and marks it edited", async () => {
    const orgId = await newOrg("Visit edits");
    const office = await member(orgId, "Olive", null, "office");
    const a = await project(orgId, "Job A");
    await withTenant(orgId, async (tx) => {
      const me = await createWorker(tx, orgId, { name: "Pat", kind: "employee" });
      const at = (iso: string) => new Date(iso);
      const [v1] = await tx.execute<{ id: string }>(sql`insert into site_visits (org_id, worker_id, project_id, checked_in_at, checked_out_at) values (${orgId}, ${me}, ${a}, ${"2026-09-01T07:00:00Z"}, ${"2026-09-01T15:00:00Z"}) returning id`);
      const [v2] = await tx.execute<{ id: string }>(sql`insert into site_visits (org_id, worker_id, project_id, checked_in_at) values (${orgId}, ${me}, ${a}, ${"2026-09-02T07:00:00Z"}) returning id`);
      // A finished visit keeps a leaving time; overlapping another visit is refused.
      expect(await reason(editVisit(tx, orgId, v1.id, office, { checkedInAt: at("2026-09-01T06:30:00Z"), checkedOutAt: null }))).toBe("visit_end");
      expect(await reason(editVisit(tx, orgId, v1.id, office, { checkedInAt: at("2026-09-01T06:30:00Z"), checkedOutAt: at("2026-09-02T08:00:00Z") }))).toBe("visit_overlap");
      expect(await reason(editVisit(tx, orgId, randomUUID(), office, { checkedInAt: at("2026-09-01T06:30:00Z"), checkedOutAt: null }))).toBe("not_found");
      await editVisit(tx, orgId, v1.id, office, { checkedInAt: at("2026-09-01T06:30:00Z"), checkedOutAt: at("2026-09-01T15:30:00Z") });
      // The forgotten check-out: the open visit is closed by the office.
      await editVisit(tx, orgId, v2.id, office, { checkedInAt: at("2026-09-02T07:00:00Z"), checkedOutAt: at("2026-09-02T16:00:00Z") });
      const visits = await listVisits(tx, orgId, { from: "2026-09-01", to: "2026-09-02", workerId: me });
      expect(visits.map((v) => [v.checkedInAt.toISOString(), v.checkedOutAt?.toISOString(), v.editedByName])).toEqual([
        ["2026-09-02T07:00:00.000Z", "2026-09-02T16:00:00.000Z", "Olive"],
        ["2026-09-01T06:30:00.000Z", "2026-09-01T15:30:00.000Z", "Olive"],
      ]);
      expect(visits.every((v) => v.editedAt)).toBe(true);
    });
  });
});

describe("isolation", () => {
  it("keeps each company's team to itself", async () => {
    const a = await newOrg("Team iso A");
    const b = await newOrg("Team iso B");
    const w = await withTenant(a, (tx) => createWorker(tx, a, { name: "Ann", kind: "employee" }));
    const bLogin = await member(b, "Bob", null);
    await withTenant(b, async (tx) => {
      expect(await getWorker(tx, b, w)).toBeUndefined();
      expect(await reason(addCertificate(tx, b, w, { name: "CSCS" }))).toBe("not_found");
      expect(await reason(linkWorker(tx, b, w, bLogin))).toBe("not_found");
      expect(await listWorkers(tx, b, { today: TODAY })).toEqual([]);
    });
  });
});
