/**
 * Example data for a new company that asked for it at onboarding: a few services, three clients, two
 * leads, a job that's been quoted, accepted and part paid with its project under way, and a quote waiting
 * on the client. Built with the same functions the app uses, so it behaves exactly like real work. Every
 * record is listed in `sample_records`, so "Remove example data" takes away exactly these and nothing else.
 *
 * Clients use example.com addresses and nothing is emailed. Example invoices never go to Xero and example
 * quotes don't count towards the Free plan's monthly allowance.
 */
import "server-only";
import { randomUUID } from "node:crypto";
import { and, count, eq, sql } from "drizzle-orm";
import { addDays } from "@/core/payment-plan";
import type { QuoteLineInput } from "@/core/schemas";
import type { Tx } from "./index";
import { createClient } from "./clients";
import { createInvoice, markPaid } from "./invoices";
import { createLead, setStage } from "./pipeline";
import { decide } from "./portal";
import { createProjectFromQuote } from "./projects";
import { createQuote, getQuote, saveQuote } from "./quotes";
import { clients, organizations, projectTasks, projects, quotes, sampleRecords, services } from "./schema";
import { sendQuote } from "./sending";
import { createService } from "./services";

export type SampleState = "added" | "declined" | "removed" | null;

type Kind = (typeof sampleRecords.$inferInsert)["kind"];

export async function sampleDataState(tx: Tx, orgId: string): Promise<SampleState> {
  const [o] = await tx.select({ s: organizations.sampleData }).from(organizations).where(eq(organizations.id, orgId));
  return (o?.s as SampleState) ?? null;
}

/** Ask only a brand-new company: not answered yet, and nothing of their own in it. */
export async function shouldOfferSampleData(tx: Tx, orgId: string): Promise<boolean> {
  if ((await sampleDataState(tx, orgId)) !== null) return false;
  return isEmpty(tx, orgId);
}

/** Added later from Settings: not there now, and the company hasn't started its own work yet. */
export async function sampleDataCanBeAdded(tx: Tx, orgId: string): Promise<boolean> {
  return (await sampleDataState(tx, orgId)) !== "added" && (await isEmpty(tx, orgId));
}

async function isEmpty(tx: Tx, orgId: string) {
  const [c] = await tx.select({ n: count() }).from(clients).where(eq(clients.orgId, orgId));
  const [q] = await tx.select({ n: count() }).from(quotes).where(eq(quotes.orgId, orgId));
  const [s] = await tx.select({ n: count() }).from(services).where(eq(services.orgId, orgId));
  return c.n + q.n + s.n === 0;
}

export async function declineSampleData(tx: Tx, orgId: string) {
  await tx
    .update(organizations)
    .set({ sampleData: "declined" })
    .where(and(eq(organizations.id, orgId), sql`${organizations.sampleData} is null`));
}

const line = (name: string, qty: number, ratePence: number, serviceId: string | undefined, unit: string, markupBps = 2000): QuoteLineInput => ({
  name,
  qty,
  unit,
  ratePence,
  markupBps,
  serviceId,
  noteVisible: false,
  kind: "normal",
});

/**
 * Add the examples. Returns false if they're already there (so a double click adds nothing twice), or the
 * company has started its own work.
 * Runs in one transaction: it all goes in, or none of it does.
 */
export async function addSampleData(tx: Tx, orgId: string, memberId: string, today: string): Promise<boolean> {
  // Claim the answer first: a second request waits on this row, then sees "added" and stops.
  const claimed = await tx
    .update(organizations)
    .set({ sampleData: "added" })
    .where(and(eq(organizations.id, orgId), sql`${organizations.sampleData} is distinct from 'added'`))
    .returning({ id: organizations.id });
  if (claimed.length === 0) return false;
  // Examples go into an empty company only: they take the first quote and invoice numbers.
  if (!(await isEmpty(tx, orgId))) throw new SampleDataInUse();

  const track = (kind: Kind, recordId: string) => tx.insert(sampleRecords).values({ orgId, kind, recordId });

  // ── Service library ──
  const svc = async (category: string, name: string, unit: string, ratePence: number, description?: string) => {
    const id = await createService(tx, orgId, { category, name, unit, ratePence, description, kind: "service" });
    await track("service", id);
    return id;
  };
  const skim = await svc("Plastering", "Skim coat, walls", "m²", 1_200, "Two-coat skim over prepared plasterboard or sound plaster.");
  const labour = await svc("Labour", "General builder, day rate", "day", 18_000);
  const sockets = await svc("Electrics", "Double socket, first and second fix", "point", 6_500, "New circuit or spur, chased in, with a white plastic faceplate.");
  const units = await svc("Kitchens", "Fit kitchen base unit", "unit", 9_500, "Supplied by client. Level, fix and connect.");
  const skip = await svc("Waste", "8-yard skip hire", "item", 32_000);
  const blocks = await svc("Groundworks", "Strip foundation, dig and pour", "m", 14_500, "600 mm wide, 1 m deep, C25 concrete. Building control inspection included.");

  // ── Clients ──
  const client = async (input: Parameters<typeof createClient>[2]) => {
    const id = await createClient(tx, orgId, input);
    await track("client", id);
    return id;
  };
  const hale = await client({
    name: "Sarah Hale (example)",
    email: "sarah.hale@example.com",
    phone: "07700 900123",
    address: { line1: "14 Elm Road", town: "Bristol", postcode: "BS7 8AA" },
    source: "Referral",
    notes: "Example client. Prefers calls after 5pm.",
  });
  const okafor = await client({
    name: "James and Priya Okafor (example)",
    email: "okafor.family@example.com",
    phone: "07700 900456",
    address: { line1: "3 Mill Lane", town: "Bath", postcode: "BA1 5QT" },
    source: "Website",
    notes: "Example client.",
  });
  await client({
    name: "Northgate Developments Ltd (example)",
    email: "accounts@northgate.example.com",
    address: { line1: "Unit 4, Riverside Park", town: "Bristol", postcode: "BS2 0SP" },
    source: "Repeat client",
    notes: "Example main contractor: VAT and CIS registered, so their quotes use the VAT reverse charge.",
    vatTreatment: "reverse_charge",
  });

  // ── Leads in the pipeline ──
  const lead1 = await createLead(
    tx,
    orgId,
    {
      name: "Tom Fletcher (example)",
      phone: "07700 900789",
      postcode: "BS6 6XX",
      source: "checkatrade",
      projectType: "Loft conversion",
      description: "Dormer loft conversion with an en suite.",
      valuePence: 5_500_000,
    },
    { memberId, today },
  );
  await track("lead", lead1);
  const lead2 = await createLead(
    tx,
    orgId,
    { name: "Anna Kowalska (example)", postcode: "BA2 3LL", source: "google", projectType: "Bathroom", description: "Full bathroom refit, walk-in shower.", valuePence: 1_200_000 },
    { memberId, today },
  );
  await track("lead", lead2);
  await setStage(tx, orgId, lead2, { stage: "site_visit" }, memberId);

  // ── A job: quoted, accepted, deposit paid, under way ──
  const kitchenQuote = await createQuote(tx, orgId, { clientId: hale, title: "Kitchen extension, 14 Elm Road" });
  await track("quote", kitchenQuote);
  const kq = (await getQuote(tx, orgId, kitchenQuote))!;
  const prep = kq.sections[0].id;
  const build = randomUUID();
  const electrics = randomUUID();
  const deposit = randomUUID();
  const firstFix = randomUUID();
  await saveQuote(tx, orgId, {
    quoteId: kitchenQuote,
    baseVersion: kq.quote.version,
    ops: [
      { op: "renameSection", sectionId: prep, name: "Groundworks" },
      { op: "addLine", sectionId: prep, lineId: randomUUID(), position: 0, line: line("Strip foundation, dig and pour", 14, 14_500, blocks, "m") },
      { op: "addLine", sectionId: prep, lineId: randomUUID(), position: 1, line: line("8-yard skip hire", 3, 32_000, skip, "item", 1000) },
      { op: "addSection", sectionId: build, position: 1, name: "Building work" },
      { op: "addLine", sectionId: build, lineId: randomUUID(), position: 0, line: line("General builder, day rate", 30, 18_000, labour, "day") },
      { op: "addLine", sectionId: build, lineId: randomUUID(), position: 1, line: line("Skim coat, walls", 64, 1_200, skim, "m²") },
      { op: "addLine", sectionId: build, lineId: randomUUID(), position: 2, line: line("Fit kitchen base unit", 8, 9_500, units, "unit") },
      { op: "addSection", sectionId: electrics, position: 2, name: "Electrics" },
      { op: "addLine", sectionId: electrics, lineId: randomUUID(), position: 0, line: line("Double socket, first and second fix", 12, 6_500, sockets, "point") },
    ],
    paymentPlan: [
      { id: deposit, label: "Deposit", amountKind: "percent", amountValue: 2500, dueKind: "on_acceptance" },
      { id: firstFix, label: "First fix complete", amountKind: "percent", amountValue: 4000, dueKind: "milestone" },
      { id: randomUUID(), label: "Completion", amountKind: "balance", dueKind: "milestone" },
    ],
  });
  await sendQuote(tx, orgId, { quoteId: kitchenQuote, baseVersion: (await getQuote(tx, orgId, kitchenQuote))!.quote.version, memberId });
  await decide(tx, orgId, hale, kq.quote.number, { decision: "accepted", fullName: "Sarah Hale", signature: "Sarah Hale", agree: true }, { ip: null, userAgent: "Example data" });

  const depositInvoice = await createInvoice(tx, orgId, { quoteId: kitchenQuote, stageId: deposit, memberId }, today, { sample: true });
  await track("invoice", depositInvoice.id);
  await markPaid(tx, orgId, depositInvoice.id, today, "Example payment");
  const stageInvoice = await createInvoice(tx, orgId, { quoteId: kitchenQuote, stageId: firstFix, memberId }, today, { sample: true });
  await track("invoice", stageInvoice.id);

  const project = await createProjectFromQuote(tx, orgId, { quoteId: kitchenQuote, tasksFromLines: true, startDate: addDays(today, -14) }, memberId);
  await track("project", project);
  await tx
    .update(projects)
    .set({ status: "on_site", endDate: addDays(today, 42) })
    .where(and(eq(projects.orgId, orgId), eq(projects.id, project)));
  // The groundworks are done and building is under way.
  const tasks = await tx
    .select({ id: projectTasks.id, position: projectTasks.position })
    .from(projectTasks)
    .where(and(eq(projectTasks.orgId, orgId), eq(projectTasks.projectId, project)));
  for (const t of tasks) {
    const status = t.position <= 1 ? "done" : t.position === 2 ? "in_progress" : "todo";
    await tx
      .update(projectTasks)
      .set({ status, completedAt: status === "done" ? new Date() : null, dueDate: addDays(today, t.position * 5 - 5) })
      .where(and(eq(projectTasks.orgId, orgId), eq(projectTasks.id, t.id)));
  }

  // ── A quote waiting on the client ──
  const bathQuote = await createQuote(tx, orgId, { clientId: okafor, title: "Family bathroom refit" });
  await track("quote", bathQuote);
  const bq = (await getQuote(tx, orgId, bathQuote))!;
  await saveQuote(tx, orgId, {
    quoteId: bathQuote,
    baseVersion: bq.quote.version,
    ops: [
      { op: "renameSection", sectionId: bq.sections[0].id, name: "Bathroom" },
      { op: "addLine", sectionId: bq.sections[0].id, lineId: randomUUID(), position: 0, line: line("General builder, day rate", 8, 18_000, labour, "day") },
      { op: "addLine", sectionId: bq.sections[0].id, lineId: randomUUID(), position: 1, line: line("Skim coat, walls", 22, 1_200, skim, "m²") },
      { op: "addLine", sectionId: bq.sections[0].id, lineId: randomUUID(), position: 2, line: line("8-yard skip hire", 1, 32_000, skip, "item", 1000) },
    ],
  });
  await sendQuote(tx, orgId, { quoteId: bathQuote, baseVersion: (await getQuote(tx, orgId, bathQuote))!.quote.version, memberId });
  return true;
}

export class SampleDataInUse extends Error {}

/**
 * Remove every example record (the database function deletes only what `sample_records` lists, in this
 * company). If real work was built on an example, such as an invoice raised on the example quote, a
 * foreign key stops it and nothing is removed.
 */
export async function removeSampleData(tx: Tx, orgId: string): Promise<number> {
  try {
    const [r] = await tx.execute<{ n: number }>(sql`select app_remove_sample_data(${orgId}::uuid) as n`);
    await tx.update(organizations).set({ sampleData: "removed" }).where(eq(organizations.id, orgId));
    return Number(r?.n ?? 0);
  } catch (error) {
    const code = (error as { code?: string; cause?: { code?: string } }).cause?.code ?? (error as { code?: string }).code;
    if (code === "23503") throw new SampleDataInUse();
    throw error;
  }
}
