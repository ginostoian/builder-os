"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { MERGE_FIELDS, fillMergeFields, type MergeValues } from "@/core/pipeline";
import { can, type Permission } from "@/core/roles";
import { automationInput, id, isoDate, leadEmailInput, leadInput, multiLine, singleLine, stageChangeInput } from "@/core/schemas";
import { TEXT } from "@/core/limits";
import { ukToday } from "@/core/payment-plan";
import {
  PipelineError,
  addAutomationTemplate,
  addNote,
  createAutomation,
  createLead,
  deleteAutomation,
  deleteLead,
  enquiryAlertContext,
  getLead,
  logLeadEmail,
  mergeFacts,
  setAutomationEnabled,
  setEnquiryForm,
  setFollowUp,
  setStage,
  startQuoteForLead,
  stopRun,
  updateAutomation,
  updateLead,
  type PipelineErrorReason,
} from "@/db/pipeline";
import { memberEmail } from "@/db/sending";
import { getSession, withSession, type Session } from "@/auth/session";
import { leadMergeValues, runCompanyAutomations, toParagraphs } from "@/server/automations";
import { emailConfigured, sendEmail } from "@/server/email";
import { appOrigin } from "@/server/origin";

export type PipelineActionResult = { ok: true; id?: string } | { ok: false; message: string };

const MESSAGES: Record<PipelineErrorReason, string> = {
  not_found: "This lead was removed or changed somewhere else. Reload to see the latest.",
  unknown_member: "Choose someone on your team.",
  unknown_template: "That template isn't available.",
  no_email: "This lead has no email address.",
};

async function allowed(permission: Permission): Promise<Session | null> {
  const session = await getSession();
  return can(session.role, permission) ? session : null;
}

/** Run a change; afterwards refresh the pipeline and send any automation emails it started. */
async function run(permission: Permission, fn: (s: Session) => Promise<string | void>, leadId?: string): Promise<PipelineActionResult> {
  const session = await allowed(permission);
  if (!session) return { ok: false, message: permission === "automations.manage" ? "Only Admins and the office can change automations." : "Your role can't change leads." };
  let result: string | void;
  try {
    result = await fn(session);
  } catch (error) {
    if (error instanceof PipelineError) return { ok: false, message: MESSAGES[error.reason] };
    throw error;
  }
  after(() => runCompanyAutomations(session.orgId).catch(() => undefined));
  revalidatePath("/app/pipeline");
  revalidatePath("/app");
  if (leadId) revalidatePath(`/app/pipeline/${leadId}`);
  return { ok: true, id: result || undefined };
}

const issue = (e: z.ZodError) => {
  const field = String(e.issues[0]?.path[0] ?? "");
  const labels: Record<string, string> = { name: "Enter their name.", email: "Check the email address.", phone: "Check the phone number.", postcode: "Check the postcode.", valuePence: "Check the value.", lostReason: "Say why it was lost.", steps: e.issues[0]?.message ?? "Check the emails.", stage: "Choose the stage.", subject: "Write a subject.", body: "Write the email." };
  return labels[field] ?? "Check what you've entered.";
};

// ── Leads ────────────────────────────────────────────────────────────────────

export async function saveLeadAction(leadId: string | null, input: unknown): Promise<PipelineActionResult> {
  const parsed = leadInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: issue(parsed.error) };
  if (leadId !== null && !id.safeParse(leadId).success) return { ok: false, message: MESSAGES.not_found };
  return run(
    "leads.edit",
    (s) =>
      withSession(s, async (tx) => {
        if (leadId) {
          await updateLead(tx, s.orgId, leadId, parsed.data, s.memberId);
          return leadId;
        }
        return createLead(tx, s.orgId, { ...parsed.data, ownerMemberId: parsed.data.ownerMemberId ?? s.memberId }, { memberId: s.memberId, today: ukToday() });
      }),
    leadId ?? undefined,
  );
}

export async function setStageAction(leadId: string, input: unknown): Promise<PipelineActionResult> {
  const parsed = stageChangeInput.safeParse(input);
  if (!parsed.success || !id.safeParse(leadId).success) return { ok: false, message: parsed.success ? MESSAGES.not_found : issue(parsed.error) };
  return run("leads.edit", (s) => withSession(s, (tx) => setStage(tx, s.orgId, leadId, parsed.data, s.memberId)), leadId);
}

const followUp = z.strictObject({ on: isoDate.nullable(), action: singleLine(TEXT.line).optional() });

export async function setFollowUpAction(leadId: string, input: unknown): Promise<PipelineActionResult> {
  const parsed = followUp.safeParse(input);
  if (!parsed.success || !id.safeParse(leadId).success) return { ok: false, message: "Check the date." };
  return run("leads.edit", (s) => withSession(s, (tx) => setFollowUp(tx, s.orgId, leadId, parsed.data.on, parsed.data.action ?? null)), leadId);
}

const note = z.strictObject({ kind: z.enum(["note", "call"]), body: multiLine(TEXT.note).pipe(z.string().min(1)) });

export async function addNoteAction(leadId: string, input: unknown): Promise<PipelineActionResult> {
  const parsed = note.safeParse(input);
  if (!parsed.success || !id.safeParse(leadId).success) return { ok: false, message: "Write something first." };
  return run("leads.edit", (s) => withSession(s, (tx) => addNote(tx, s.orgId, leadId, parsed.data.kind, parsed.data.body, s.memberId)), leadId);
}

export async function deleteLeadAction(leadId: string): Promise<PipelineActionResult> {
  if (!id.safeParse(leadId).success) return { ok: false, message: MESSAGES.not_found };
  const r = await run("leads.edit", (s) => withSession(s, (tx) => deleteLead(tx, s.orgId, leadId)));
  if (r.ok) redirect("/app/pipeline");
  return r;
}

/** Start the quote (and client record) for a lead, then open it. */
export async function startQuoteAction(leadId: string): Promise<PipelineActionResult> {
  if (!id.safeParse(leadId).success) return { ok: false, message: MESSAGES.not_found };
  const session = await allowed("quotes.edit");
  if (!session) return { ok: false, message: "Your role can't write quotes." };
  let quoteId: string;
  try {
    quoteId = await withSession(session, (tx) => startQuoteForLead(tx, session.orgId, leadId, session.memberId));
  } catch (error) {
    if (error instanceof PipelineError) return { ok: false, message: MESSAGES[error.reason] };
    throw error;
  }
  after(() => runCompanyAutomations(session.orgId).catch(() => undefined));
  revalidatePath("/app/pipeline");
  redirect(`/app/quotes/${quoteId}`);
}

export async function stopRunAction(leadId: string, runId: string): Promise<PipelineActionResult> {
  if (!id.safeParse(runId).success) return { ok: false, message: MESSAGES.not_found };
  return run("leads.edit", (s) => withSession(s, (tx) => stopRun(tx, s.orgId, runId)), leadId);
}

/** Email a lead from their page (merge fields work here too). Replies come to you. */
export async function emailLeadAction(leadId: string, input: unknown): Promise<PipelineActionResult> {
  const parsed = leadEmailInput.safeParse(input);
  if (!parsed.success || !id.safeParse(leadId).success) return { ok: false, message: parsed.success ? MESSAGES.not_found : issue(parsed.error) };
  const session = await allowed("leads.edit");
  if (!session) return { ok: false, message: "Your role can't email leads." };
  if (!emailConfigured()) return { ok: false, message: "Email isn't set up yet. Use your own email app for now." };
  const origin = await appOrigin();
  const ctx = await withSession(session, async (tx) => {
    const found = await getLead(tx, session.orgId, leadId);
    if (!found) return null;
    const company = await enquiryAlertContext(tx, session.orgId);
    const values = await leadMergeValues(tx, session.orgId, found.lead, await mergeFacts(tx, session.orgId, found.lead), company.company, origin);
    return { found, company, values: { ...values, my_name: session.memberName.split(" ")[0] } as MergeValues, replyTo: await memberEmail(tx, session.orgId, session.memberId) };
  });
  if (!ctx) return { ok: false, message: MESSAGES.not_found };
  if (!ctx.found.lead.email) return { ok: false, message: MESSAGES.no_email };
  const subject = fillMergeFields(parsed.data.subject, ctx.values).trim();
  const body = fillMergeFields(parsed.data.body, ctx.values);
  const sent = await sendEmail({
    to: ctx.found.lead.email,
    replyTo: ctx.replyTo,
    subject,
    fromName: ctx.company.company,
    content: { company: { name: ctx.company.company, brandColour: ctx.company.brandColour }, preheader: subject, heading: "", paragraphs: toParagraphs(body), footer: `Sent by ${session.memberName}, ${ctx.company.company}.` },
  });
  if (!sent.ok) return { ok: false, message: sent.message };
  await withSession(session, (tx) => logLeadEmail(tx, session.orgId, leadId, "email", `Sent: ${subject}\n\n${body}`, session.memberId));
  revalidatePath(`/app/pipeline/${leadId}`);
  return { ok: true };
}

// ── Automations ──────────────────────────────────────────────────────────────

export async function saveAutomationAction(automationId: string | null, input: unknown): Promise<PipelineActionResult> {
  const parsed = automationInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: issue(parsed.error) };
  if (automationId !== null && !id.safeParse(automationId).success) return { ok: false, message: MESSAGES.not_found };
  const r = await run("automations.manage", (s) =>
    withSession(s, async (tx) => {
      if (automationId) {
        await updateAutomation(tx, s.orgId, automationId, parsed.data);
        return automationId;
      }
      return createAutomation(tx, s.orgId, parsed.data);
    }),
  );
  revalidatePath("/app/pipeline/automations");
  return r;
}

export async function setAutomationEnabledAction(automationId: string, on: boolean): Promise<PipelineActionResult> {
  if (!id.safeParse(automationId).success) return { ok: false, message: MESSAGES.not_found };
  const r = await run("automations.manage", (s) => withSession(s, (tx) => setAutomationEnabled(tx, s.orgId, automationId, on === true)));
  revalidatePath("/app/pipeline/automations");
  return r;
}

export async function deleteAutomationAction(automationId: string): Promise<PipelineActionResult> {
  if (!id.safeParse(automationId).success) return { ok: false, message: MESSAGES.not_found };
  const r = await run("automations.manage", (s) => withSession(s, (tx) => deleteAutomation(tx, s.orgId, automationId)));
  if (r.ok) redirect("/app/pipeline/automations");
  return r;
}

export async function addTemplateAction(key: string): Promise<PipelineActionResult> {
  if (typeof key !== "string") return { ok: false, message: MESSAGES.unknown_template };
  const r = await run("automations.manage", (s) => withSession(s, (tx) => addAutomationTemplate(tx, s.orgId, key)));
  revalidatePath("/app/pipeline/automations");
  return r;
}

/** Send yourself one step of an automation, filled in with example details, to see how it reads. */
export async function sendTestAction(input: unknown): Promise<PipelineActionResult> {
  const parsed = z.strictObject({ subject: singleLine(TEXT.line), body: multiLine(4_000).pipe(z.string().min(1)) }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Write the subject and the email first." };
  const session = await allowed("automations.manage");
  if (!session) return { ok: false, message: "Only Admins and the office can test automations." };
  if (!emailConfigured()) return { ok: false, message: "Email isn't set up yet, so test emails can't be sent." };
  const ctx = await withSession(session, async (tx) => ({ to: await memberEmail(tx, session.orgId, session.memberId), company: await enquiryAlertContext(tx, session.orgId) }));
  if (!ctx.to) return { ok: false, message: "Your login has no email address." };
  const sample = Object.fromEntries(MERGE_FIELDS.map((f) => [f.key, f.sample])) as MergeValues;
  sample.company = ctx.company.company;
  sample.my_name = session.memberName.split(" ")[0];
  const body = fillMergeFields(parsed.data.body, sample);
  const r = await sendEmail({
    to: ctx.to,
    subject: `[Test] ${fillMergeFields(parsed.data.subject, sample)}`,
    fromName: ctx.company.company,
    content: { company: { name: ctx.company.company, brandColour: ctx.company.brandColour }, preheader: "A test of your automation email", heading: "", paragraphs: toParagraphs(body), footer: "A test send, filled in with example details." },
  });
  return r.ok ? { ok: true } : { ok: false, message: r.message };
}

// ── Web form ─────────────────────────────────────────────────────────────────

/** Switch the website enquiry form on (or give it a new link) or off. */
export async function setEnquiryFormAction(on: boolean): Promise<PipelineActionResult> {
  const r = await run("automations.manage", (s) => withSession(s, async (tx) => (await setEnquiryForm(tx, s.orgId, on === true)) ?? undefined));
  revalidatePath("/app/pipeline/form");
  return r;
}
