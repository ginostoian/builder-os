/** The sales pipeline: leads, stage changes (by hand and from quotes), automations and their runs, lookups. */
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AutomationInput, LeadInput } from "@/core/schemas";
import { appUrl } from "@/test/db-urls";
import { closeDb, findEnquiryForm, findLeadForUnsubscribe, findOrgsWithDueAutomations, withTenant } from "./index";
import {
  PipelineError,
  addAutomationTemplate,
  claimDueEmails,
  createAutomation,
  createLead,
  followUpsDue,
  getLead,
  listAutomations,
  listLeads,
  optOut,
  pipelineInsights,
  setAutomationEnabled,
  setEnquiryForm,
  setStage,
  startQuoteForLead,
  updateAutomation,
} from "./pipeline";
import { decide } from "./portal";
import { getQuote, saveQuote } from "./quotes";
import { sendQuote } from "./sending";

const TODAY = "2026-10-05";
const NOW = new Date("2026-10-05T10:00:00Z");
const clerkId = (uuid: string) => `org_${uuid.replaceAll("-", "")}`;
const reason = (p: Promise<unknown>) =>
  p.then(
    () => "ok",
    (e: unknown) => (e instanceof PipelineError ? e.reason : String((e as { cause?: { code?: string } }).cause?.code ?? e)),
  );
const lead = (over: Partial<LeadInput> = {}): LeadInput => ({ name: "Sarah Hale", email: "sarah@example.com", source: "google", projectType: "Kitchen", ...over });
const steps = (...days: number[]) => days.map((d, i) => ({ id: randomUUID(), delayDays: d, subject: `Step ${i + 1}`, body: "Hi {{first_name}}" }));
const auto = (over: Partial<AutomationInput> = {}): AutomationInput => ({ name: "Auto", trigger: "lead_created", steps: steps(0), ...over });

async function newOrg(name: string) {
  const orgId = randomUUID();
  await withTenant(orgId, (tx) => tx.execute(sql`insert into organizations (id, clerk_org_id, name) values (${orgId}, ${clerkId(orgId)}, ${name})`));
  const memberId = await withTenant(orgId, async (tx) => (await tx.execute<{ id: string }>(sql`insert into members (org_id, clerk_user_id, role, name, email) values (${orgId}, ${"user_" + orgId.slice(0, 8)}, 'admin', 'Jo', 'jo@example.com') returning id`))[0].id);
  return { orgId, memberId };
}

async function enabled(orgId: string, input: AutomationInput) {
  return withTenant(orgId, async (tx) => {
    const id = await createAutomation(tx, orgId, input);
    await setAutomationEnabled(tx, orgId, id, true);
    return id;
  });
}

beforeAll(() => {
  process.env.DATABASE_URL = appUrl();
});
afterAll(async () => {
  await closeDb();
});

describe("pipeline", () => {
  it("adds leads with a follow-up for today and starts the matching automations", async () => {
    const { orgId, memberId } = await newOrg("Pipe leads");
    await enabled(orgId, auto({ name: "Any lead" }));
    await enabled(orgId, auto({ name: "Web only", trigger: "web_enquiry" }));
    await withTenant(orgId, (tx) => createAutomation(tx, orgId, auto({ name: "Switched off" })));
    const phoned = await withTenant(orgId, (tx) => createLead(tx, orgId, lead(), { memberId, today: TODAY, now: NOW }));
    const web = await withTenant(orgId, (tx) => createLead(tx, orgId, lead({ name: "Web Person", source: "website" }), { memberId: null, viaWebForm: true, today: TODAY, now: NOW }));
    const noEmail = await withTenant(orgId, (tx) => createLead(tx, orgId, lead({ name: "No Email", email: undefined }), { memberId, today: TODAY, now: NOW }));
    await withTenant(orgId, async (tx) => {
      const a = (await getLead(tx, orgId, phoned))!;
      expect(a.lead).toMatchObject({ stage: "new", nextActionOn: TODAY, nextAction: "Call back" });
      expect(a.activity.map((x) => x.kind)).toEqual(["created"]);
      expect(a.runs.map((r) => r.name)).toEqual(["Any lead"]);
      expect((await getLead(tx, orgId, web))!.runs.map((r) => r.name).sort()).toEqual(["Any lead", "Web only"]);
      expect((await getLead(tx, orgId, noEmail))!.runs).toEqual([]);
      expect((await followUpsDue(tx, orgId, TODAY)).map((l) => l.name).sort()).toEqual(["No Email", "Sarah Hale", "Web Person"]);
      expect((await listLeads(tx, orgId, { search: "web" })).map((l) => l.name)).toEqual(["Web Person"]);
    });
  });

  it("sends each step once, in order, and stops when the lead moves on", async () => {
    const { orgId, memberId } = await newOrg("Pipe runs");
    const followUp = await enabled(orgId, auto({ name: "Quote follow-up", trigger: "stage_entered", stage: "quote_sent", steps: steps(0, 3, 4) }));
    const id = await withTenant(orgId, (tx) => createLead(tx, orgId, lead(), { memberId, today: TODAY, now: NOW }));
    await withTenant(orgId, (tx) => setStage(tx, orgId, id, { stage: "quote_sent" }, memberId, NOW));
    expect(await findOrgsWithDueAutomations(NOW)).toContain(orgId);
    const first = await withTenant(orgId, (tx) => claimDueEmails(tx, orgId, NOW));
    expect(first.map((e) => [e.step.subject, e.stepNo, e.stepCount, e.lead.email])).toEqual([["Step 1", 1, 3, "sarah@example.com"]]);
    // Claimed: running again sends nothing until the next step is due (8 October, start of the UK day).
    expect(await withTenant(orgId, (tx) => claimDueEmails(tx, orgId, NOW))).toEqual([]);
    const run = (await withTenant(orgId, (tx) => getLead(tx, orgId, id)))!.runs[0];
    expect(run).toMatchObject({ status: "active", step: 1, nextAt: new Date("2026-10-07T23:00:00Z") });
    // Emails more than 3 days overdue (say email wasn't set up yet) are skipped, not sent late.
    const other = await withTenant(orgId, (tx) => createLead(tx, orgId, lead({ name: "Late" }), { memberId, today: TODAY, now: NOW }));
    await withTenant(orgId, (tx) => setStage(tx, orgId, other, { stage: "quote_sent" }, memberId, NOW));
    expect((await withTenant(orgId, (tx) => claimDueEmails(tx, orgId, new Date("2026-10-08T12:00:00Z")))).map((e) => [e.lead.name, e.step.subject])).toEqual([["Sarah Hale", "Step 2"]]);
    expect((await withTenant(orgId, (tx) => getLead(tx, orgId, other)))!.runs[0]).toMatchObject({ status: "stopped", endedReason: "Missed: too late to send" });
    // Accepted before step 3: the follow-ups stop.
    await withTenant(orgId, (tx) => setStage(tx, orgId, id, { stage: "won" }, memberId));
    expect(await withTenant(orgId, (tx) => claimDueEmails(tx, orgId, new Date("2026-10-20T08:00:00Z")))).toEqual([]);
    const after = (await withTenant(orgId, (tx) => getLead(tx, orgId, id)))!;
    expect(after.runs[0]).toMatchObject({ status: "stopped", endedReason: "Moved to another stage" });
    expect(after.lead).toMatchObject({ stage: "won", nextActionOn: null });
    expect((await withTenant(orgId, (tx) => listAutomations(tx, orgId))).find((a) => a.id === followUp)).toMatchObject({ sent: 2, active: 0 });
  });

  it("finishes after the last step, and honours unsubscribes and switching off", async () => {
    const { orgId, memberId } = await newOrg("Pipe stop");
    const one = await enabled(orgId, auto({ name: "One", steps: steps(0) }));
    const a = await withTenant(orgId, (tx) => createLead(tx, orgId, lead(), { memberId, today: TODAY, now: NOW }));
    expect(await withTenant(orgId, (tx) => claimDueEmails(tx, orgId, NOW))).toHaveLength(1);
    expect((await withTenant(orgId, (tx) => getLead(tx, orgId, a)))!.runs[0]).toMatchObject({ status: "done", endedReason: "Finished" });
    const b = await withTenant(orgId, (tx) => createLead(tx, orgId, lead({ name: "B" }), { memberId, today: TODAY, now: NOW }));
    const c = await withTenant(orgId, (tx) => createLead(tx, orgId, lead({ name: "C" }), { memberId, today: TODAY, now: NOW }));
    const tokenB = (await withTenant(orgId, (tx) => getLead(tx, orgId, b)))!.lead.unsubscribeToken;
    expect(await findLeadForUnsubscribe(tokenB)).toEqual({ orgId, leadId: b });
    await withTenant(orgId, (tx) => optOut(tx, orgId, b));
    await withTenant(orgId, (tx) => setAutomationEnabled(tx, orgId, one, false));
    expect(await withTenant(orgId, (tx) => claimDueEmails(tx, orgId, NOW))).toEqual([]);
    await withTenant(orgId, async (tx) => {
      expect((await getLead(tx, orgId, b))!.runs[0]).toMatchObject({ status: "stopped", endedReason: "Unsubscribed" });
      expect((await getLead(tx, orgId, c))!.runs[0]).toMatchObject({ status: "stopped", endedReason: "Automation switched off" });
      // Opted out: never enrolled again.
      await setAutomationEnabled(tx, orgId, one, true);
      await setStage(tx, orgId, b, { stage: "contacted" }, memberId);
    });
    // Changing an automation's trigger ends its live runs.
    const stageAuto = await enabled(orgId, auto({ name: "Contacted", trigger: "stage_entered", stage: "contacted", steps: steps(5) }));
    await withTenant(orgId, (tx) => setStage(tx, orgId, c, { stage: "contacted" }, memberId));
    await withTenant(orgId, (tx) => updateAutomation(tx, orgId, stageAuto, auto({ name: "Contacted", trigger: "stage_entered", stage: "site_visit", steps: steps(5) })));
    expect((await withTenant(orgId, (tx) => getLead(tx, orgId, c)))!.runs.find((r) => r.automationId === stageAuto)).toMatchObject({ status: "stopped", endedReason: "Automation changed" });
    expect((await withTenant(orgId, (tx) => getLead(tx, orgId, b)))!.runs).toHaveLength(1);
  });

  it("follows the quote: started from the lead, sent, then won or lost", async () => {
    const { orgId, memberId } = await newOrg("Pipe quotes");
    const id = await withTenant(orgId, (tx) => createLead(tx, orgId, lead({ address: { line1: "14 Elm Road", town: "London", postcode: "N1 7AA" }, phone: "07700 900123" }), { memberId, today: TODAY }));
    const quoteId = await withTenant(orgId, (tx) => startQuoteForLead(tx, orgId, id, memberId));
    expect(await withTenant(orgId, (tx) => startQuoteForLead(tx, orgId, id, memberId))).toBe(quoteId);
    await withTenant(orgId, async (tx) => {
      const l = (await getLead(tx, orgId, id))!;
      expect(l).toMatchObject({ clientName: "Sarah Hale", quoteStatus: "draft", quoteTitle: "Kitchen" });
      expect(l.lead.stage).toBe("quoting");
      const q = (await getQuote(tx, orgId, quoteId))!;
      await saveQuote(tx, orgId, { quoteId, baseVersion: 0, ops: [{ op: "addLine", sectionId: q.sections[0].id, lineId: randomUUID(), position: 0, line: { name: "Fit kitchen", qty: 1, unit: "job", ratePence: 500_000, markupBps: 2000, noteVisible: false, kind: "normal" } }] });
      await sendQuote(tx, orgId, { quoteId, baseVersion: (await getQuote(tx, orgId, quoteId))!.quote.version, memberId });
      expect((await getLead(tx, orgId, id))!.lead.stage).toBe("quote_sent");
      await decide(tx, orgId, l.lead.clientId!, q.quote.number, { decision: "declined", fullName: "Sarah Hale", reason: "Too dear" }, { ip: null, userAgent: null });
      expect((await getLead(tx, orgId, id))!.lead).toMatchObject({ stage: "lost", lostReason: "declined_quote" });
    });
    // A lost lead needs a reason (the database insists too).
    expect(await reason(withTenant(orgId, (tx) => tx.execute(sql`update leads set lost_reason = null where id = ${id}`)))).toBe("23514");
  });

  it("reports by source and lost reason", async () => {
    const { orgId, memberId } = await newOrg("Pipe insights");
    await withTenant(orgId, async (tx) => {
      const a = await createLead(tx, orgId, lead({ source: "referral", valuePence: 4_000_000 }), { memberId, today: TODAY });
      const b = await createLead(tx, orgId, lead({ source: "referral" }), { memberId, today: TODAY });
      await createLead(tx, orgId, lead({ source: "google", valuePence: 1_000_000 }), { memberId, today: TODAY });
      await setStage(tx, orgId, a, { stage: "won" }, memberId);
      await setStage(tx, orgId, b, { stage: "lost", lostReason: "price" }, memberId);
      const i = await pipelineInsights(tx, orgId, new Date("2026-01-01T00:00:00Z"));
      expect(i.bySource).toEqual([
        { source: "referral", leads: 2, won: 1, lost: 1, wonValue: 4_000_000 },
        { source: "google", leads: 1, won: 0, lost: 0, wonValue: 0 },
      ]);
      expect(i.lostReasons).toEqual([{ reason: "price", n: 1 }]);
      expect(i.avgDaysToWin).toBe(0);
      expect(i.open).toEqual([{ stage: "new", n: 1, value: 1_000_000 }]);
    });
  });

  it("opens the web form by its token and adds ready-made automations switched off", async () => {
    const { orgId } = await newOrg("Pipe form");
    const t = await withTenant(orgId, (tx) => setEnquiryForm(tx, orgId, true));
    expect(await findEnquiryForm(t!)).toBe(orgId);
    await withTenant(orgId, (tx) => setEnquiryForm(tx, orgId, false));
    expect(await findEnquiryForm(t!)).toBeNull();
    expect(await findEnquiryForm("nope")).toBeNull();
    await withTenant(orgId, async (tx) => {
      await addAutomationTemplate(tx, orgId, "quote_follow_up");
      const [a] = await listAutomations(tx, orgId);
      expect(a).toMatchObject({ name: "Follow up a sent quote", enabled: false, trigger: "stage_entered", stage: "quote_sent", templateKey: "quote_follow_up" });
      expect(a.steps).toHaveLength(3);
    });
    expect(await reason(withTenant(orgId, (tx) => addAutomationTemplate(tx, orgId, "nope")))).toBe("unknown_template");
  });

  it("keeps each company's pipeline to itself", async () => {
    const a = await newOrg("Pipe A");
    const b = await newOrg("Pipe B");
    const id = await withTenant(a.orgId, (tx) => createLead(tx, a.orgId, lead(), { memberId: a.memberId, today: TODAY }));
    await withTenant(b.orgId, async (tx) => {
      expect(await listLeads(tx, a.orgId)).toEqual([]);
      expect(await getLead(tx, b.orgId, id)).toBeUndefined();
      expect(await claimDueEmails(tx, a.orgId, NOW)).toEqual([]);
    });
    expect(await reason(withTenant(b.orgId, (tx) => setStage(tx, b.orgId, id, { stage: "contacted" }, b.memberId)))).toBe("not_found");
    expect(await reason(withTenant(a.orgId, (tx) => createLead(tx, a.orgId, lead({ ownerMemberId: b.memberId }), { memberId: a.memberId, today: TODAY })))).toBe("unknown_member");
  });
});
