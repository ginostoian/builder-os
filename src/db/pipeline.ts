/**
 * The sales pipeline: leads, what happened with them, and the company's email automations. Stage changes
 * go through `setStage`, which logs them, stops automation runs that belong to the old stage, and starts
 * the ones for the new stage. Quotes move their lead along (sent → Quote sent, accepted → Won, declined
 * → Lost) from inside `sendQuote` and `decide`.
 */
import "server-only";
import { randomBytes } from "node:crypto";
import { and, asc, count, desc, eq, gte, inArray, isNotNull, lte, ne, or, sql } from "drizzle-orm";
import { londonDay } from "@/core/team";
import {
  AUTOMATION_TEMPLATES,
  OPEN_STAGES,
  stepDueAt,
  type AutomationStep,
  type AutomationTrigger,
  type LeadStage,
  type LostReason,
} from "@/core/pipeline";
import type { AutomationInput, LeadInput, StageChangeInput } from "@/core/schemas";
import type { Tx } from "./index";
import { createClient } from "./clients";
import { createQuote } from "./quotes";
import { automationRuns, automations, clients, leadActivities, leads, members, organizations, quotes } from "./schema";

export type PipelineErrorReason = "not_found" | "unknown_member" | "unknown_template" | "no_email";

export class PipelineError extends Error {
  constructor(readonly reason: PipelineErrorReason) {
    super(reason);
  }
}

const token = () => randomBytes(24).toString("base64url");

type ActivityKind = (typeof leadActivities.$inferInsert)["kind"];

async function log(tx: Tx, orgId: string, leadId: string, kind: ActivityKind, body: string, memberId: string | null = null) {
  await tx.insert(leadActivities).values({ orgId, leadId, kind, body: body.slice(0, 8_000), memberId });
}

async function assertMember(tx: Tx, orgId: string, memberId: string | undefined) {
  if (!memberId) return;
  const [m] = await tx.select({ id: members.id }).from(members).where(and(eq(members.orgId, orgId), eq(members.id, memberId), eq(members.active, true)));
  if (!m) throw new PipelineError("unknown_member");
}

// ── Leads ────────────────────────────────────────────────────────────────────

export type LeadFilter = { stages?: LeadStage[]; ownerId?: string; search?: string; closedSince?: Date };

/** Leads with their owner and quote. Open ones, plus won and lost ones changed since `closedSince`. */
export async function listLeads(tx: Tx, orgId: string, f: LeadFilter = {}) {
  const term = f.search?.trim().slice(0, 100);
  return tx
    .select({
      id: leads.id,
      name: leads.name,
      email: leads.email,
      phone: leads.phone,
      address: leads.address,
      postcode: leads.postcode,
      source: leads.source,
      projectType: leads.projectType,
      description: leads.description,
      budget: leads.budget,
      valuePence: leads.valuePence,
      stage: leads.stage,
      stageChangedAt: leads.stageChangedAt,
      ownerMemberId: leads.ownerMemberId,
      ownerName: members.name,
      nextActionOn: leads.nextActionOn,
      nextAction: leads.nextAction,
      visitAt: leads.visitAt,
      lostReason: leads.lostReason,
      quoteId: leads.quoteId,
      quoteNumber: quotes.number,
      quoteStatus: quotes.status,
      viaWebForm: leads.viaWebForm,
      createdAt: leads.createdAt,
    })
    .from(leads)
    .leftJoin(members, and(eq(members.orgId, leads.orgId), eq(members.id, leads.ownerMemberId)))
    .leftJoin(quotes, and(eq(quotes.orgId, leads.orgId), eq(quotes.id, leads.quoteId)))
    .where(
      and(
        eq(leads.orgId, orgId),
        f.stages ? inArray(leads.stage, f.stages) : undefined,
        f.ownerId ? eq(leads.ownerMemberId, f.ownerId) : undefined,
        f.closedSince ? or(inArray(leads.stage, [...OPEN_STAGES]), gte(leads.stageChangedAt, f.closedSince)) : undefined,
        term
          ? sql`(${leads.name} ilike ${"%" + term.replace(/[%_\\]/g, "\\$&") + "%"} or ${leads.email} ilike ${"%" + term.replace(/[%_\\]/g, "\\$&") + "%"} or ${leads.phone} ilike ${"%" + term.replace(/[%_\\]/g, "\\$&") + "%"} or coalesce(${leads.postcode}, ${leads.address}->>'postcode') ilike ${"%" + term.replace(/[%_\\]/g, "\\$&") + "%"})`
          : undefined,
      ),
    )
    .orderBy(sql`${leads.nextActionOn} asc nulls last`, desc(leads.createdAt))
    .limit(1_000);
}

export type LeadRow = Awaited<ReturnType<typeof listLeads>>[number];

export async function getLead(tx: Tx, orgId: string, leadId: string) {
  const [row] = await tx
    .select({ lead: leads, ownerName: members.name, ownerEmail: members.email, quoteNumber: quotes.number, quoteStatus: quotes.status, quoteTitle: quotes.title, clientName: clients.name })
    .from(leads)
    .leftJoin(members, and(eq(members.orgId, leads.orgId), eq(members.id, leads.ownerMemberId)))
    .leftJoin(quotes, and(eq(quotes.orgId, leads.orgId), eq(quotes.id, leads.quoteId)))
    .leftJoin(clients, and(eq(clients.orgId, leads.orgId), eq(clients.id, leads.clientId)))
    .where(and(eq(leads.orgId, orgId), eq(leads.id, leadId)));
  if (!row) return undefined;
  const activity = await tx
    .select({ id: leadActivities.id, kind: leadActivities.kind, body: leadActivities.body, createdAt: leadActivities.createdAt, memberName: members.name })
    .from(leadActivities)
    .leftJoin(members, and(eq(members.orgId, leadActivities.orgId), eq(members.id, leadActivities.memberId)))
    .where(and(eq(leadActivities.orgId, orgId), eq(leadActivities.leadId, leadId)))
    .orderBy(desc(leadActivities.createdAt))
    .limit(200);
  const runs = await tx
    .select({ id: automationRuns.id, automationId: automations.id, name: automations.name, status: automationRuns.status, step: automationRuns.step, steps: automations.steps, nextAt: automationRuns.nextAt, endedReason: automationRuns.endedReason, createdAt: automationRuns.createdAt })
    .from(automationRuns)
    .innerJoin(automations, and(eq(automations.orgId, automationRuns.orgId), eq(automations.id, automationRuns.automationId)))
    .where(and(eq(automationRuns.orgId, orgId), eq(automationRuns.leadId, leadId)))
    .orderBy(desc(automationRuns.createdAt))
    .limit(50);
  return { ...row, activity, runs: runs.map((r) => ({ ...r, stepCount: r.steps.length, steps: undefined })) };
}

const leadColumns = (input: LeadInput) => ({
  name: input.name,
  email: input.email ?? null,
  phone: input.phone ?? null,
  address: input.address ?? null,
  postcode: input.postcode ?? input.address?.postcode ?? null,
  source: input.source,
  sourceDetail: input.sourceDetail ?? null,
  projectType: input.projectType ?? null,
  description: input.description ?? null,
  budget: input.budget ?? null,
  valuePence: input.valuePence ?? null,
  ownerMemberId: input.ownerMemberId ?? null,
});

/**
 * Add a lead. `viaWebForm` marks website enquiries (they start the "web enquiry" automations too). New
 * leads get a follow-up for today, so nobody forgets to call back.
 */
export async function createLead(tx: Tx, orgId: string, input: LeadInput, opts: { memberId: string | null; viaWebForm?: boolean; today: string; now?: Date }): Promise<string> {
  await assertMember(tx, orgId, input.ownerMemberId);
  const [row] = await tx
    .insert(leads)
    .values({ orgId, ...leadColumns(input), viaWebForm: opts.viaWebForm ?? false, unsubscribeToken: token(), nextActionOn: opts.today, nextAction: "Call back", createdByMemberId: opts.memberId })
    .returning({ id: leads.id });
  await log(tx, orgId, row.id, "created", opts.viaWebForm ? "Enquiry from your website form" : "Lead added", opts.memberId);
  const now = opts.now ?? new Date();
  if (opts.viaWebForm) await enroll(tx, orgId, row.id, "web_enquiry", "new", now);
  await enroll(tx, orgId, row.id, "lead_created", "new", now);
  return row.id;
}

export async function updateLead(tx: Tx, orgId: string, leadId: string, input: LeadInput) {
  await assertMember(tx, orgId, input.ownerMemberId);
  const rows = await tx.update(leads).set(leadColumns(input)).where(and(eq(leads.orgId, orgId), eq(leads.id, leadId))).returning({ id: leads.id, email: leads.email });
  if (rows.length === 0) throw new PipelineError("not_found");
  // No email address any more: nothing left to send.
  if (!rows[0].email) await stopRuns(tx, orgId, leadId, "No email address");
}

export async function deleteLead(tx: Tx, orgId: string, leadId: string) {
  const rows = await tx.delete(leads).where(and(eq(leads.orgId, orgId), eq(leads.id, leadId))).returning({ id: leads.id });
  if (rows.length === 0) throw new PipelineError("not_found");
}

/**
 * Move a lead to a stage. Logs it, stops automations that belonged to the old stage, and starts the new
 * stage's. Booking a site visit records when; losing a lead records why.
 */
export async function setStage(tx: Tx, orgId: string, leadId: string, change: StageChangeInput, memberId: string | null, now = new Date()) {
  const [lead] = await tx.select({ stage: leads.stage, visitAt: leads.visitAt }).from(leads).where(and(eq(leads.orgId, orgId), eq(leads.id, leadId)));
  if (!lead) throw new PipelineError("not_found");
  const visitAt = change.visitAt ? new Date(change.visitAt) : null;
  const sameStage = lead.stage === change.stage;
  await tx
    .update(leads)
    .set({
      stage: change.stage,
      ...(sameStage ? {} : { stageChangedAt: now }),
      lostReason: change.stage === "lost" ? (change.lostReason as LostReason) : null,
      lostNote: change.stage === "lost" ? (change.lostNote ?? null) : null,
      ...(visitAt ? { visitAt } : {}),
      // Won or lost: nothing left to chase.
      ...(change.stage === "won" || change.stage === "lost" ? { nextActionOn: null, nextAction: null } : {}),
    })
    .where(and(eq(leads.orgId, orgId), eq(leads.id, leadId)));
  if (visitAt && (!lead.visitAt || lead.visitAt.getTime() !== visitAt.getTime())) await log(tx, orgId, leadId, "visit", `Site visit booked for ${visitAt.toISOString()}`, memberId);
  if (sameStage) return;
  await log(tx, orgId, leadId, "stage", change.stage === "lost" && change.lostNote ? `${change.stage}: ${change.lostNote}` : change.stage, memberId);
  await stopRuns(tx, orgId, leadId, "Moved to another stage", change.stage);
  await enroll(tx, orgId, leadId, "stage_entered", change.stage, now);
}

export async function setFollowUp(tx: Tx, orgId: string, leadId: string, on: string | null, action: string | null) {
  const rows = await tx.update(leads).set({ nextActionOn: on, nextAction: on ? action : null }).where(and(eq(leads.orgId, orgId), eq(leads.id, leadId))).returning({ id: leads.id });
  if (rows.length === 0) throw new PipelineError("not_found");
}

/** A note or a logged call. */
export async function addNote(tx: Tx, orgId: string, leadId: string, kind: "note" | "call", body: string, memberId: string) {
  const [l] = await tx.select({ stage: leads.stage }).from(leads).where(and(eq(leads.orgId, orgId), eq(leads.id, leadId)));
  if (!l) throw new PipelineError("not_found");
  await log(tx, orgId, leadId, kind, body, memberId);
}

export const logLeadEmail = (tx: Tx, orgId: string, leadId: string, kind: "email" | "automation_email", body: string, memberId: string | null) => log(tx, orgId, leadId, kind, body, memberId);

/**
 * Start a quote for a lead: their client record (made from the lead if there isn't one) and a draft quote.
 * The lead moves to Quoting.
 */
export async function startQuoteForLead(tx: Tx, orgId: string, leadId: string, memberId: string): Promise<string> {
  const [l] = await tx.select().from(leads).where(and(eq(leads.orgId, orgId), eq(leads.id, leadId)));
  if (!l) throw new PipelineError("not_found");
  if (l.quoteId) return l.quoteId;
  const clientId = l.clientId ?? (await createClient(tx, orgId, { name: l.name, email: l.email ?? undefined, phone: l.phone ?? undefined, address: l.address ?? undefined }));
  const quoteId = await createQuote(tx, orgId, { clientId, title: (l.projectType ?? "New project").slice(0, 120) });
  await tx.update(leads).set({ clientId, quoteId }).where(and(eq(leads.orgId, orgId), eq(leads.id, leadId)));
  await log(tx, orgId, leadId, "quote", "Quote started", memberId);
  if ((["new", "contacted", "site_visit"] as LeadStage[]).includes(l.stage)) await setStage(tx, orgId, leadId, { stage: "quoting" }, memberId);
  return quoteId;
}

/** The quote went to the client: its lead (if any) moves to Quote sent. Called from `sendQuote`. */
export async function leadQuoteSent(tx: Tx, orgId: string, quoteId: string) {
  const rows = await tx.select({ id: leads.id }).from(leads).where(and(eq(leads.orgId, orgId), eq(leads.quoteId, quoteId), inArray(leads.stage, ["new", "contacted", "site_visit", "quoting"])));
  for (const r of rows) await setStage(tx, orgId, r.id, { stage: "quote_sent" }, null);
}

/** The client accepted or declined: the lead is won or lost. Called from the portal decision. */
export async function leadQuoteDecided(tx: Tx, orgId: string, quoteId: string, accepted: boolean) {
  const rows = await tx.select({ id: leads.id }).from(leads).where(and(eq(leads.orgId, orgId), eq(leads.quoteId, quoteId), inArray(leads.stage, [...OPEN_STAGES])));
  for (const r of rows) await setStage(tx, orgId, r.id, accepted ? { stage: "won" } : { stage: "lost", lostReason: "declined_quote" }, null);
}

/** Leads whose follow-up is due today or overdue (for the dashboard and the pipeline's "Due" list). */
export async function followUpsDue(tx: Tx, orgId: string, today: string, ownerId?: string) {
  return tx
    .select({ id: leads.id, name: leads.name, stage: leads.stage, nextActionOn: leads.nextActionOn, nextAction: leads.nextAction, phone: leads.phone, projectType: leads.projectType })
    .from(leads)
    .where(and(eq(leads.orgId, orgId), inArray(leads.stage, [...OPEN_STAGES]), isNotNull(leads.nextActionOn), lte(leads.nextActionOn, today), ownerId ? eq(leads.ownerMemberId, ownerId) : undefined))
    .orderBy(asc(leads.nextActionOn), asc(leads.name))
    .limit(100);
}

/**
 * How the pipeline is doing over a period: leads, wins and win rate by source; lost reasons; time from
 * enquiry to a win; and the value of what's open now.
 */
export async function pipelineInsights(tx: Tx, orgId: string, since: Date) {
  const bySource = await tx
    .select({
      source: leads.source,
      leads: count(),
      won: sql<number>`count(*) filter (where ${leads.stage} = 'won')`.mapWith(Number),
      lost: sql<number>`count(*) filter (where ${leads.stage} = 'lost')`.mapWith(Number),
      wonValue: sql<number>`coalesce(sum(${leads.valuePence}) filter (where ${leads.stage} = 'won'), 0)`.mapWith(Number),
    })
    .from(leads)
    .where(and(eq(leads.orgId, orgId), gte(leads.createdAt, since)))
    .groupBy(leads.source)
    .orderBy(desc(count()));
  const lostReasons = await tx
    .select({ reason: leads.lostReason, n: count() })
    .from(leads)
    .where(and(eq(leads.orgId, orgId), eq(leads.stage, "lost"), gte(leads.stageChangedAt, since)))
    .groupBy(leads.lostReason)
    .orderBy(desc(count()));
  const [speed] = await tx
    .select({ avgDaysToWin: sql<number | null>`avg(extract(epoch from (${leads.stageChangedAt} - ${leads.createdAt})) / 86400)`.mapWith((v) => (v === null ? null : Math.round(Number(v)))) })
    .from(leads)
    .where(and(eq(leads.orgId, orgId), eq(leads.stage, "won"), gte(leads.stageChangedAt, since)));
  const open = await tx
    .select({ stage: leads.stage, n: count(), value: sql<number>`coalesce(sum(${leads.valuePence}), 0)`.mapWith(Number) })
    .from(leads)
    .where(and(eq(leads.orgId, orgId), inArray(leads.stage, [...OPEN_STAGES])))
    .groupBy(leads.stage);
  return { bySource, lostReasons, avgDaysToWin: speed?.avgDaysToWin ?? null, open };
}

// ── Automations ──────────────────────────────────────────────────────────────

export async function listAutomations(tx: Tx, orgId: string) {
  return tx
    .select({
      id: automations.id,
      name: automations.name,
      enabled: automations.enabled,
      trigger: automations.trigger,
      stage: automations.stage,
      steps: automations.steps,
      templateKey: automations.templateKey,
      active: sql<number>`(select count(*) from automation_runs r where r.org_id = "automations"."org_id" and r.automation_id = "automations"."id" and r.status = 'active')`.mapWith(Number),
      sent: sql<number>`(select coalesce(sum(r.step), 0) from automation_runs r where r.org_id = "automations"."org_id" and r.automation_id = "automations"."id")`.mapWith(Number),
    })
    .from(automations)
    .where(eq(automations.orgId, orgId))
    .orderBy(asc(automations.createdAt));
}

export async function getAutomation(tx: Tx, orgId: string, automationId: string) {
  const [a] = await tx.select().from(automations).where(and(eq(automations.orgId, orgId), eq(automations.id, automationId)));
  return a;
}

export async function createAutomation(tx: Tx, orgId: string, input: AutomationInput, templateKey: string | null = null): Promise<string> {
  const [row] = await tx
    .insert(automations)
    .values({ orgId, name: input.name, trigger: input.trigger, stage: input.trigger === "stage_entered" ? (input.stage ?? null) : null, steps: input.steps, templateKey })
    .returning({ id: automations.id });
  return row.id;
}

/** Add one of the ready-made automations (switched off, to read and adjust first). */
export async function addAutomationTemplate(tx: Tx, orgId: string, key: string): Promise<string> {
  const t = AUTOMATION_TEMPLATES.find((x) => x.key === key);
  if (!t) throw new PipelineError("unknown_template");
  return createAutomation(tx, orgId, { name: t.name, trigger: t.trigger, stage: t.stage ?? undefined, steps: t.steps.map((s) => ({ ...s, id: crypto.randomUUID() })) }, t.key);
}

/** Change an automation. Leads already in it carry on from their next step (with the new wording). */
export async function updateAutomation(tx: Tx, orgId: string, automationId: string, input: AutomationInput) {
  const before = await getAutomation(tx, orgId, automationId);
  if (!before) throw new PipelineError("not_found");
  await tx
    .update(automations)
    .set({ name: input.name, trigger: input.trigger, stage: input.trigger === "stage_entered" ? (input.stage ?? null) : null, steps: input.steps })
    .where(and(eq(automations.orgId, orgId), eq(automations.id, automationId)));
  // A different trigger means a different audience: the old runs end.
  if (before.trigger !== input.trigger || before.stage !== (input.trigger === "stage_entered" ? input.stage : null)) {
    await tx
      .update(automationRuns)
      .set({ status: "stopped", nextAt: null, endedReason: "Automation changed" })
      .where(and(eq(automationRuns.orgId, orgId), eq(automationRuns.automationId, automationId), eq(automationRuns.status, "active")));
  }
}

/** Switch on or off. Off stops everyone in it; on applies to leads from now on (no back-filling). */
export async function setAutomationEnabled(tx: Tx, orgId: string, automationId: string, enabled: boolean) {
  const rows = await tx.update(automations).set({ enabled }).where(and(eq(automations.orgId, orgId), eq(automations.id, automationId))).returning({ id: automations.id });
  if (rows.length === 0) throw new PipelineError("not_found");
  if (!enabled) {
    await tx
      .update(automationRuns)
      .set({ status: "stopped", nextAt: null, endedReason: "Automation switched off" })
      .where(and(eq(automationRuns.orgId, orgId), eq(automationRuns.automationId, automationId), eq(automationRuns.status, "active")));
  }
}

export async function deleteAutomation(tx: Tx, orgId: string, automationId: string) {
  const rows = await tx.delete(automations).where(and(eq(automations.orgId, orgId), eq(automations.id, automationId))).returning({ id: automations.id });
  if (rows.length === 0) throw new PipelineError("not_found");
}

/** Start the matching, switched-on automations for a lead (if it has an email address and hasn't opted out). */
async function enroll(tx: Tx, orgId: string, leadId: string, trigger: AutomationTrigger, stage: LeadStage, now: Date) {
  const [l] = await tx.select({ email: leads.email, optOut: leads.emailOptOut }).from(leads).where(and(eq(leads.orgId, orgId), eq(leads.id, leadId)));
  if (!l?.email || l.optOut) return;
  const matching = await tx
    .select({ id: automations.id, steps: automations.steps })
    .from(automations)
    .where(and(eq(automations.orgId, orgId), eq(automations.enabled, true), eq(automations.trigger, trigger), trigger === "stage_entered" ? eq(automations.stage, stage) : undefined));
  for (const a of matching) {
    if (a.steps.length === 0) continue;
    await tx
      .insert(automationRuns)
      .values({ orgId, automationId: a.id, leadId, stage, nextAt: stepDueAt(now, a.steps[0].delayDays, londonDay) })
      .onConflictDoNothing();
  }
}

/** Stop a lead's live runs: all of them, or (with `keepStage`) those that don't belong to that stage. */
async function stopRuns(tx: Tx, orgId: string, leadId: string, reason: string, keepStage?: LeadStage) {
  await tx
    .update(automationRuns)
    .set({ status: "stopped", nextAt: null, endedReason: reason })
    .where(and(eq(automationRuns.orgId, orgId), eq(automationRuns.leadId, leadId), eq(automationRuns.status, "active"), keepStage ? ne(automationRuns.stage, keepStage) : undefined));
}

export async function stopRun(tx: Tx, orgId: string, runId: string) {
  const rows = await tx
    .update(automationRuns)
    .set({ status: "stopped", nextAt: null, endedReason: "Stopped by hand" })
    .where(and(eq(automationRuns.orgId, orgId), eq(automationRuns.id, runId), eq(automationRuns.status, "active")))
    .returning({ id: automationRuns.id });
  if (rows.length === 0) throw new PipelineError("not_found");
}

/** They clicked "unsubscribe": no more automated emails, ever. */
export async function optOut(tx: Tx, orgId: string, leadId: string) {
  await tx.update(leads).set({ emailOptOut: true }).where(and(eq(leads.orgId, orgId), eq(leads.id, leadId)));
  await stopRuns(tx, orgId, leadId, "Unsubscribed");
  await log(tx, orgId, leadId, "note", "Unsubscribed from automated emails");
}

/** How late an automation email can be and still go out. */
const MAX_LATE_MS = 3 * 24 * 60 * 60 * 1000;

export type DueEmail = {
  runId: string;
  leadId: string;
  automationName: string;
  step: AutomationStep;
  stepNo: number;
  stepCount: number;
  lead: { name: string; email: string; projectType: string | null; visitAt: Date | null; quoteId: string | null; clientId: string | null; unsubscribeToken: string; ownerMemberId: string | null };
};

/**
 * Claim the emails due now: each run's next step is reserved (the run moves on, or ends after its last
 * step) before anything is sent, so overlapping runs never send twice. A run whose lead has left the
 * stage, opted out, lost its email address, or whose automation is off, is stopped instead.
 */
export async function claimDueEmails(tx: Tx, orgId: string, now: Date, limit = 200): Promise<DueEmail[]> {
  const due = await tx
    .select({
      run: automationRuns,
      automation: { name: automations.name, enabled: automations.enabled, steps: automations.steps },
      lead: { name: leads.name, email: leads.email, stage: leads.stage, optOut: leads.emailOptOut, projectType: leads.projectType, visitAt: leads.visitAt, quoteId: leads.quoteId, clientId: leads.clientId, unsubscribeToken: leads.unsubscribeToken, ownerMemberId: leads.ownerMemberId },
    })
    .from(automationRuns)
    .innerJoin(automations, and(eq(automations.orgId, automationRuns.orgId), eq(automations.id, automationRuns.automationId)))
    .innerJoin(leads, and(eq(leads.orgId, automationRuns.orgId), eq(leads.id, automationRuns.leadId)))
    .where(and(eq(automationRuns.orgId, orgId), eq(automationRuns.status, "active"), lte(automationRuns.nextAt, now)))
    .orderBy(asc(automationRuns.nextAt))
    .limit(limit)
    .for("update", { of: automationRuns, skipLocked: true });
  const out: DueEmail[] = [];
  for (const d of due) {
    const step = d.automation.steps[d.run.step];
    // Days late (email wasn't set up, or the run was down): a "thanks for your enquiry" a week on does more
    // harm than good, so it's skipped rather than sent.
    const late = d.run.nextAt && now.getTime() - d.run.nextAt.getTime() > MAX_LATE_MS;
    const stop = late ? "Missed: too late to send" : !d.automation.enabled ? "Automation switched off" : d.lead.optOut ? "Unsubscribed" : !d.lead.email ? "No email address" : d.lead.stage !== d.run.stage ? "Moved to another stage" : !step ? "Finished" : null;
    if (stop) {
      await tx
        .update(automationRuns)
        .set({ status: stop === "Finished" ? "done" : "stopped", nextAt: null, endedReason: stop })
        .where(eq(automationRuns.id, d.run.id));
      continue;
    }
    const next = d.automation.steps[d.run.step + 1];
    await tx
      .update(automationRuns)
      .set(next ? { step: d.run.step + 1, nextAt: stepDueAt(now, next.delayDays, londonDay) } : { step: d.run.step + 1, status: "done", nextAt: null, endedReason: "Finished" })
      .where(eq(automationRuns.id, d.run.id));
    out.push({
      runId: d.run.id,
      leadId: d.run.leadId,
      automationName: d.automation.name,
      step,
      stepNo: d.run.step + 1,
      stepCount: d.automation.steps.length,
      lead: { ...d.lead, email: d.lead.email! },
    });
  }
  return out;
}

// ── The web enquiry form ─────────────────────────────────────────────────────

export async function enquiryToken(tx: Tx, orgId: string): Promise<string | null> {
  const [o] = await tx.select({ t: organizations.enquiryToken }).from(organizations).where(eq(organizations.id, orgId));
  return o?.t ?? null;
}

/** Turn the form on (new link), change its link (the old one stops working), or turn it off (null). */
export async function setEnquiryForm(tx: Tx, orgId: string, on: boolean): Promise<string | null> {
  const t = on ? token() : null;
  await tx.update(organizations).set({ enquiryToken: t }).where(eq(organizations.id, orgId));
  return t;
}

/** Website enquiries in the last `minutes`, to slow down floods. */
export async function recentWebEnquiries(tx: Tx, orgId: string, minutes: number): Promise<number> {
  const [r] = await tx
    .select({ n: count() })
    .from(leads)
    .where(and(eq(leads.orgId, orgId), eq(leads.viaWebForm, true), gte(leads.createdAt, sql`now() - make_interval(mins => ${minutes})`)));
  return r?.n ?? 0;
}

/** Who hears about new website enquiries: active admins and office. */
export async function enquiryAlertContext(tx: Tx, orgId: string) {
  const [org] = await tx.select({ name: organizations.name, tradingName: organizations.tradingName, brandColour: organizations.brandColour, logoUrl: organizations.logoUrl }).from(organizations).where(eq(organizations.id, orgId));
  const people = await tx
    .select({ email: members.email })
    .from(members)
    .where(and(eq(members.orgId, orgId), eq(members.active, true), inArray(members.role, ["admin", "office"]), isNotNull(members.email)));
  return { company: org?.tradingName ?? org?.name ?? "", brandColour: org?.brandColour ?? null, logoUrl: org?.logoUrl ?? null, to: [...new Set(people.flatMap((p) => (p.email ? [p.email] : [])))] };
}

/** What a lead's merge fields need from elsewhere: its owner and its quote (number and whether it was sent). */
export async function mergeFacts(tx: Tx, orgId: string, lead: { ownerMemberId: string | null; quoteId: string | null }) {
  const [owner] = lead.ownerMemberId ? await tx.select({ name: members.name, email: members.email }).from(members).where(and(eq(members.orgId, orgId), eq(members.id, lead.ownerMemberId))) : [];
  const [quote] = lead.quoteId ? await tx.select({ number: quotes.number, status: quotes.status }).from(quotes).where(and(eq(quotes.orgId, orgId), eq(quotes.id, lead.quoteId))) : [];
  return { ownerName: owner?.name ?? null, ownerEmail: owner?.email ?? null, quote: quote ?? null };
}

/** People who can own leads. */
export async function leadOwners(tx: Tx, orgId: string) {
  return tx
    .select({ id: members.id, name: members.name })
    .from(members)
    .where(and(eq(members.orgId, orgId), eq(members.active, true), inArray(members.role, ["admin", "office", "estimator", "site_lead"])))
    .orderBy(asc(members.name));
}


