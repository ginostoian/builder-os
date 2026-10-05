/**
 * Zod schemas for everything that crosses a trust boundary (Server Actions, Route Handlers, webhooks).
 * Server code must parse input with these before it reaches the database. Never trust the client's types.
 *
 * Conventions:
 * - Objects are strict: unknown keys are rejected, so a client can't smuggle `orgId` or `id` into a write.
 * - Tenant (`orgId`) is never part of an input schema. It always comes from the session on the server.
 * - Money is integer pence, percentages are basis points, quantities have at most 3 decimals.
 */
import { z } from "zod";
import { MAX_VARIATION_LINES } from "./variation";
import { PROJECT_STATUSES, TASK_STATUSES, WEATHER } from "./projects";
import { WORKER_KINDS } from "./team";
import { EXPENSE_CATEGORIES, MAX_PO_LINES } from "./costs";
import { AUTOMATION_TRIGGERS, LEAD_SOURCES, LEAD_STAGES, LOST_REASONS, MAX_AUTOMATION_STEPS, MAX_DELAY_DAYS } from "./pipeline";
import { MAX_PAYMENT_STAGES, PAYMENT_AMOUNT_KINDS, PAYMENT_DUE_KINDS } from "./payment-plan";
import { MAX_BUNDLE_ITEMS, MAX_LINES_PER_QUOTE, MAX_MARKUP_BPS, MAX_PATCH_OPS, MAX_QTY, MAX_RATE_PENCE, MAX_VAT_BPS, QTY_DECIMALS, TEXT } from "./limits";

// Control characters other than tab and newline. They break PDFs and CSV exports and hide content.
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const CONTROL_OR_NEWLINE = /[\u0000-\u001F\u007F]/;

/** Single-line text: trimmed, non-empty, no control characters or newlines. */
export const singleLine = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((s) => !CONTROL_OR_NEWLINE.test(s), "Must not contain control characters");

/** Multi-line text: trimmed, may be empty, newlines and tabs allowed. */
export const multiLine = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine((s) => !CONTROL_CHARS.test(s), "Must not contain control characters");

export const id = z.uuid();
export const pence = z.int().min(0).max(MAX_RATE_PENCE);
export const markupBps = z.int().min(0).max(MAX_MARKUP_BPS);
export const vatBps = z.int().min(0).max(MAX_VAT_BPS);
export const qty = z
  .number()
  .min(0)
  .max(MAX_QTY)
  .refine((n) => {
    const scaled = n * 10 ** QTY_DECIMALS;
    return Math.abs(scaled - Math.round(scaled)) < 1e-6;
  }, `At most ${QTY_DECIMALS} decimal places`);
export const email = z.email().max(TEXT.email).toLowerCase();
export const phone = z
  .string()
  .trim()
  .max(TEXT.phone)
  .regex(/^[+0-9 ()-]*$/, "Digits, spaces, +, ( ) and - only");
export const isoDate = z.iso.date();
/** Only https URLs. Rejects javascript:, data:, http: and friends before they reach an href or <img>. */
export const httpsUrl = z.url({ protocol: /^https$/, hostname: z.regexes.domain }).max(2_000);

export const ROLES = ["admin", "office", "estimator", "site_lead", "employee"] as const;
export const role = z.enum(ROLES);

export const SERVICE_KINDS = ["service", "bundle"] as const;
export const LINE_KINDS = ["normal", "pc_sum", "provisional"] as const;
export const QUOTE_STATUSES = ["draft", "sent", "viewed", "accepted", "declined", "expired"] as const;

export const address = z.strictObject({
  line1: singleLine(TEXT.name),
  line2: singleLine(TEXT.name).optional(),
  town: singleLine(TEXT.short),
  postcode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{1,2}[0-9][A-Z0-9]? ?[0-9][A-Z]{2}$/, "Enter a UK postcode"),
});
export type Address = z.infer<typeof address>;

// ── Company settings ─────────────────────────────────────────────────────────

export const orgSettingsInput = z.strictObject({
  name: singleLine(TEXT.name),
  tradingName: singleLine(TEXT.name).optional(),
  vatNumber: z
    .string()
    .trim()
    .toUpperCase()
    .transform((s) => s.replace(/\s/g, ""))
    .pipe(z.string().regex(/^(GB)?(\d{9}|\d{12}|GD\d{3}|HA\d{3})$/, "Enter a UK VAT number"))
    .optional(),
  logoUrl: httpsUrl.optional(),
  brandColour: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Hex colour like #1F6FEB")
    .optional(),
  defaultMarkupBps: markupBps,
  defaultVatRateBps: vatBps,
  quoteTerms: multiLine(TEXT.terms).optional(),
});
export type OrgSettingsInput = z.infer<typeof orgSettingsInput>;

// ── Clients ──────────────────────────────────────────────────────────────────

export const clientInput = z.strictObject({
  name: singleLine(TEXT.name),
  email: email.optional(),
  phone: phone.optional(),
  address: address.optional(),
  source: singleLine(TEXT.short).optional(),
  notes: multiLine(TEXT.note).optional(),
});
export type ClientInput = z.infer<typeof clientInput>;

// ── Service library ──────────────────────────────────────────────────────────

export const serviceInput = z.strictObject({
  category: singleLine(TEXT.short),
  name: singleLine(TEXT.line),
  description: multiLine(TEXT.description).optional(),
  unit: singleLine(TEXT.short),
  ratePence: pence,
  defaultMarkupBps: markupBps.optional(),
  kind: z.enum(SERVICE_KINDS).default("service"),
});
export type ServiceInput = z.infer<typeof serviceInput>;

/**
 * A bundle: several services added to a quote together. It has no rate of its own: its price is the sum of
 * its items (qty × rate), worked out on the server. Bundles can't contain bundles.
 */
export const bundleInput = z.strictObject({
  category: singleLine(TEXT.short),
  name: singleLine(TEXT.line),
  description: multiLine(TEXT.description).optional(),
  unit: singleLine(TEXT.short),
  defaultMarkupBps: markupBps.optional(),
  items: z
    .array(z.strictObject({ serviceId: id, qty: qty.refine((n) => n > 0, "Must be more than 0") }))
    .min(1, "Add at least one service")
    .max(MAX_BUNDLE_ITEMS)
    .refine((items) => new Set(items.map((i) => i.serviceId)).size === items.length, "Each service can only appear once"),
});
export type BundleInput = z.infer<typeof bundleInput>;

// ── Quotes ───────────────────────────────────────────────────────────────────

export const quoteHeaderInput = z.strictObject({
  clientId: id,
  title: singleLine(TEXT.name),
  siteAddress: address.optional(),
  validUntil: isoDate.optional(),
  markupBps: markupBps,
  vatRateBps: vatBps,
});
export type QuoteHeaderInput = z.infer<typeof quoteHeaderInput>;

export const quoteLineInput = z.strictObject({
  serviceId: id.optional(),
  name: singleLine(TEXT.line),
  qty,
  unit: singleLine(TEXT.short),
  ratePence: pence,
  markupBps,
  note: multiLine(TEXT.note).optional(),
  noteVisible: z.boolean().default(false),
  kind: z.enum(LINE_KINDS).default("normal"),
});
export type QuoteLineInput = z.infer<typeof quoteLineInput>;

/** Fields a grid cell edit may change. `id`, `orgId`, `sectionId` are deliberately absent. */
const lineField = z.discriminatedUnion("field", [
  z.strictObject({ field: z.literal("name"), value: quoteLineInput.shape.name }),
  z.strictObject({ field: z.literal("qty"), value: qty }),
  z.strictObject({ field: z.literal("unit"), value: quoteLineInput.shape.unit }),
  z.strictObject({ field: z.literal("ratePence"), value: pence }),
  z.strictObject({ field: z.literal("markupBps"), value: markupBps }),
  z.strictObject({ field: z.literal("note"), value: multiLine(TEXT.note) }),
  z.strictObject({ field: z.literal("noteVisible"), value: z.boolean() }),
  z.strictObject({ field: z.literal("kind"), value: z.enum(LINE_KINDS) }),
]);

const position = z.int().min(0).max(MAX_LINES_PER_QUOTE);

/** One grid operation. Ids for new sections and lines are made by the browser (`crypto.randomUUID`). */
export const quoteOp = z.discriminatedUnion("op", [
  z.strictObject({ op: z.literal("addSection"), sectionId: id, name: singleLine(TEXT.name), position }),
  z.strictObject({ op: z.literal("renameSection"), sectionId: id, name: singleLine(TEXT.name) }),
  z.strictObject({ op: z.literal("moveSection"), sectionId: id, position }),
  z.strictObject({ op: z.literal("removeSection"), sectionId: id }),
  z.strictObject({ op: z.literal("addLine"), sectionId: id, lineId: id, position, line: quoteLineInput }),
  z.strictObject({ op: z.literal("updateLine"), lineId: id, change: lineField }),
  z.strictObject({ op: z.literal("moveLine"), lineId: id, sectionId: id, position }),
  z.strictObject({ op: z.literal("removeLine"), lineId: id }),
]);
export type QuoteOp = z.infer<typeof quoteOp>;

/**
 * Autosave patch from the quote grid (plan §4 "Request patterns"). The server applies ops in order,
 * inside one tenant transaction, and rejects the whole patch if `baseVersion` is stale.
 */
export const quotePatch = z.strictObject({
  quoteId: id,
  baseVersion: z.int().min(0),
  ops: z.array(quoteOp).min(1).max(MAX_PATCH_OPS),
});
export type QuotePatch = z.infer<typeof quotePatch>;

/** One payment in a quote's plan. Percent is basis points of the total; fixed is pence, VAT included. */
export const paymentStageInput = z
  .strictObject({
    id,
    label: singleLine(TEXT.name),
    amountKind: z.enum(PAYMENT_AMOUNT_KINDS),
    amountValue: z.int().min(0).max(MAX_RATE_PENCE).optional(),
    dueKind: z.enum(PAYMENT_DUE_KINDS),
    dueDate: isoDate.optional(),
  })
  .refine((st) => st.amountKind === "balance" || st.amountValue !== undefined, "Enter an amount")
  .refine((st) => st.amountKind !== "percent" || (st.amountValue ?? 0) <= 10_000, "A percentage can't be more than 100%")
  .refine((st) => st.dueKind !== "date" || st.dueDate !== undefined, "Pick a due date");

export const paymentPlanInput = z
  .array(paymentStageInput)
  .max(MAX_PAYMENT_STAGES)
  .refine((plan) => plan.filter((st) => st.amountKind === "balance").length <= 1, "Only one payment can be the remaining balance")
  .refine((plan) => new Set(plan.map((st) => st.id)).size === plan.length, "Duplicate payment");
export type PaymentPlanInput = z.infer<typeof paymentPlanInput>;

/** One autosave from the quote builder: header changes, grid ops, or both, against `baseVersion`. */
export const quoteSave = z
  .strictObject({
    quoteId: id,
    baseVersion: z.int().min(0),
    header: quoteHeaderInput.optional(),
    ops: z.array(quoteOp).max(MAX_PATCH_OPS).default([]),
    /** The whole plan (replaces the old one); an empty array clears it. */
    paymentPlan: paymentPlanInput.optional(),
  })
  .refine((s) => s.header !== undefined || s.ops.length > 0 || s.paymentPlan !== undefined, "Nothing to save");
export type QuoteSave = z.infer<typeof quoteSave>;

/** Starting a quote: who it's for and what it's called. Everything else comes from company defaults. */
export const newQuoteInput = z.strictObject({ clientId: id, title: singleLine(TEXT.name) });
export type NewQuoteInput = z.infer<typeof newQuoteInput>;

// ── Sending and the client portal ────────────────────────────────────────────

/** Send a draft: freeze it into a version and (optionally) email the client their portal link. */
export const sendQuoteInput = z.strictObject({
  quoteId: id,
  /** The draft version the person was looking at. A stale one means it changed under them. */
  baseVersion: z.int().min(0),
  email: z.boolean(),
  message: multiLine(TEXT.note).optional(),
});
export type SendQuoteInput = z.infer<typeof sendQuoteInput>;

export const portalToken = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

/** A comment from the client portal, optionally about one line of the quote. */
export const portalCommentInput = z.strictObject({
  name: singleLine(TEXT.name),
  body: multiLine(TEXT.note).pipe(z.string().min(1, "Write a comment")),
  lineId: id.optional(),
});
export type PortalCommentInput = z.infer<typeof portalCommentInput>;

/** Accept (typed signature plus an explicit "I agree") or decline (optional reason). */
export const portalDecisionInput = z.discriminatedUnion("decision", [
  z.strictObject({ decision: z.literal("accepted"), fullName: singleLine(TEXT.name), signature: singleLine(TEXT.name), agree: z.literal(true) }),
  z.strictObject({ decision: z.literal("declined"), fullName: singleLine(TEXT.name), reason: multiLine(TEXT.note).optional() }),
]);
export type PortalDecisionInput = z.infer<typeof portalDecisionInput>;

/** A reply from the team on a sent quote. */
export const staffReplyInput = z.strictObject({ quoteId: id, body: multiLine(TEXT.note).pipe(z.string().min(1, "Write a reply")) });

// ── Payments and invoices ────────────────────────────────────────────────────

/** UK bank details for "pay by bank transfer". Sort code and account number are stored as digits. */
export const paymentSettingsInput = z.strictObject({
  bankAccountName: singleLine(TEXT.name).optional(),
  bankSortCode: z
    .string()
    .transform((v) => v.replace(/[\s-]/g, ""))
    .pipe(z.string().regex(/^\d{6}$/, "Enter a 6-digit sort code, e.g. 12-34-56"))
    .optional(),
  bankAccountNumber: z
    .string()
    .transform((v) => v.replace(/\s/g, ""))
    .pipe(z.string().regex(/^\d{8}$/, "Enter an 8-digit account number"))
    .optional(),
  paymentTermsDays: z.int().min(0).max(120),
  remindersEnabled: z.boolean(),
});
export type PaymentSettingsInput = z.infer<typeof paymentSettingsInput>;

/**
 * Raise an invoice on an accepted quote: one stage of its plan, approved variations, or a stage with
 * variations added to it.
 */
export const createInvoiceInput = z
  .strictObject({ quoteId: id, stageId: id.optional(), variationIds: z.array(id).max(50).default([]), expenseIds: z.array(id).max(200).default([]), email: z.boolean() })
  .refine((i) => i.stageId !== undefined || i.variationIds.length > 0 || i.expenseIds.length > 0, "Choose what to invoice")
  .refine((i) => new Set(i.variationIds).size === i.variationIds.length, "Duplicate variation")
  .refine((i) => new Set(i.expenseIds).size === i.expenseIds.length, "Duplicate purchase");

export const markPaidInput = z.strictObject({
  invoiceId: id,
  paidOn: isoDate,
  reference: singleLine(TEXT.short).optional(),
});

// ── Variations ───────────────────────────────────────────────────────────────

export const variationLineInput = z.strictObject({
  id,
  name: singleLine(TEXT.line),
  qty,
  unit: singleLine(TEXT.short),
  ratePence: pence,
  markupBps,
  /** Work taken out of the job: a credit. */
  omit: z.boolean(),
});

/** Saving a draft variation: its whole content (it's small). */
export const variationSaveInput = z.strictObject({
  variationId: id,
  title: singleLine(TEXT.name),
  reason: multiLine(TEXT.note).optional(),
  lines: z.array(variationLineInput).max(MAX_VARIATION_LINES),
});
export type VariationSaveInput = z.infer<typeof variationSaveInput>;

export const sendVariationInput = z.strictObject({ variationId: id, email: z.boolean() });

// ── Projects ─────────────────────────────────────────────────────────────────

const optionalDate = isoDate.optional();

/** A new project without a quote (or the details of one being edited). */
export const projectInput = z
  .strictObject({
    name: singleLine(TEXT.name),
    clientId: id,
    siteAddress: address.optional(),
    status: z.enum(PROJECT_STATUSES).default("booked"),
    startDate: optionalDate,
    endDate: optionalDate,
    managerMemberId: id.optional(),
    shareProgress: z.boolean().default(true),
  })
  .refine((p) => !p.startDate || !p.endDate || p.endDate >= p.startDate, { message: "The finish date is before the start", path: ["endDate"] });
export type ProjectInput = z.infer<typeof projectInput>;

/** Start a project from an accepted quote: stages from its sections, optionally a task per line. */
export const projectFromQuoteInput = z.strictObject({ quoteId: id, tasksFromLines: z.boolean(), startDate: optionalDate });

export const phaseInput = z.strictObject({ projectId: id, name: singleLine(TEXT.name) });

/** A task as edited in the task dialog. Omitted optional fields are cleared. */
export const taskInput = z
  .strictObject({
    projectId: id,
    phaseId: id.optional(),
    title: singleLine(TEXT.line),
    notes: multiLine(TEXT.note).optional(),
    status: z.enum(TASK_STATUSES),
    workerId: id.optional(),
    trade: singleLine(TEXT.short).optional(),
    startDate: optionalDate,
    dueDate: optionalDate,
  })
  .refine((t) => !t.startDate || !t.dueDate || t.dueDate >= t.startDate, { message: "The due date is before the start", path: ["dueDate"] });
export type TaskInput = z.infer<typeof taskInput>;

/** Drag on the board: a task's new column, and that column's order afterwards. */
export const moveTaskInput = z.strictObject({ projectId: id, taskId: id, status: z.enum(TASK_STATUSES), order: z.array(id).max(1_000) });

export const diaryInput = z.strictObject({
  projectId: id,
  entryDate: isoDate,
  body: multiLine(TEXT.note).pipe(z.string().min(1, "Write what happened")),
  weather: z.enum(WEATHER).optional(),
  shareWithClient: z.boolean(),
});
export type DiaryInput = z.infer<typeof diaryInput>;

// ── Team ─────────────────────────────────────────────────────────────────────

/** Someone on the team. Only the name is required; most firms fill the rest in over time. */
export const workerInput = z.strictObject({
  name: singleLine(TEXT.name),
  kind: z.enum(WORKER_KINDS),
  trade: singleLine(TEXT.short).optional(),
  phone: phone.optional(),
  email: email.optional(),
  dayRatePence: pence.optional(),
  startedOn: isoDate.optional(),
  emergencyName: singleLine(TEXT.name).optional(),
  emergencyPhone: phone.optional(),
  notes: multiLine(TEXT.note).optional(),
});
export type WorkerInput = z.infer<typeof workerInput>;

export const certificateInput = z.strictObject({
  name: singleLine(TEXT.name),
  reference: singleLine(TEXT.short).optional(),
  expiresOn: isoDate.optional(),
});
export type CertificateInput = z.infer<typeof certificateInput>;

/** A time of day, "HH:MM" (24 hour). */
export const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

/**
 * The office correcting a check-in: the UK day they arrived, the time, and when they left (if they have).
 * A leaving time earlier than the arrival means they left after midnight.
 */
export const visitTimesInput = z.strictObject({ day: isoDate, start: timeOfDay, end: timeOfDay.optional() });
export type VisitTimesInput = z.infer<typeof visitTimesInput>;

/** A site check-in or check-out location, when the phone shares it. */
export const geoInput = z.strictObject({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).optional();

// ── Job costs ────────────────────────────────────────────────────────────────

/** An expense: what it was, what it cost (total as on the receipt, VAT part if any), and whether it's billed back to the client. */
export const expenseInput = z
  .strictObject({
    projectId: id,
    purchaseOrderId: id.optional(),
    category: z.enum(EXPENSE_CATEGORIES),
    supplier: singleLine(TEXT.name).optional(),
    description: singleLine(TEXT.line),
    spentOn: isoDate,
    totalPence: pence,
    vatPence: pence,
    rechargeable: z.boolean(),
    rechargeMarkupBps: markupBps,
  })
  .refine((e) => e.vatPence <= e.totalPence, { message: "The VAT is more than the total", path: ["vatPence"] });
export type ExpenseInput = z.infer<typeof expenseInput>;

export const poLineInput = z.strictObject({
  id,
  description: singleLine(TEXT.line),
  qty: qty.refine((n) => n > 0, "Enter a quantity"),
  unit: singleLine(TEXT.short),
  unitPricePence: pence,
});

export const purchaseOrderInput = z.strictObject({
  projectId: id,
  supplierName: singleLine(TEXT.name),
  supplierEmail: email.optional(),
  neededBy: isoDate.optional(),
  deliveryNotes: multiLine(TEXT.note).optional(),
  vatRateBps: vatBps,
  lines: z.array(poLineInput).max(MAX_PO_LINES),
});
export type PurchaseOrderInput = z.infer<typeof purchaseOrderInput>;

// ── Sales pipeline ───────────────────────────────────────────────────────────

/** A lead's details. Only the name is needed; an enquiry often starts as a name and a number. */
export const leadInput = z.strictObject({
  name: singleLine(TEXT.name),
  email: email.optional(),
  phone: phone.optional(),
  address: address.optional(),
  postcode: singleLine(12).optional(),
  source: z.enum(LEAD_SOURCES),
  sourceDetail: singleLine(TEXT.name).optional(),
  projectType: singleLine(TEXT.short).optional(),
  description: multiLine(TEXT.note).optional(),
  budget: singleLine(TEXT.short).optional(),
  valuePence: pence.optional(),
  ownerMemberId: id.optional(),
});
export type LeadInput = z.infer<typeof leadInput>;

export const stageChangeInput = z
  .strictObject({
    stage: z.enum(LEAD_STAGES),
    lostReason: z.enum(LOST_REASONS).optional(),
    lostNote: multiLine(TEXT.note).optional(),
    visitAt: z.iso.datetime({ offset: true }).optional(),
  })
  .refine((s) => s.stage !== "lost" || s.lostReason, { message: "Say why it was lost", path: ["lostReason"] });
export type StageChangeInput = z.infer<typeof stageChangeInput>;

export const automationStepInput = z.strictObject({
  id,
  delayDays: z.int().min(0).max(MAX_DELAY_DAYS),
  subject: singleLine(TEXT.line),
  body: multiLine(4_000).pipe(z.string().min(1, "Write the email")),
});

export const automationInput = z
  .strictObject({
    name: singleLine(TEXT.name),
    trigger: z.enum(AUTOMATION_TRIGGERS),
    stage: z.enum(LEAD_STAGES).optional(),
    steps: z.array(automationStepInput).min(1, "Add at least one email").max(MAX_AUTOMATION_STEPS),
  })
  .refine((a) => (a.trigger === "stage_entered") === (a.stage !== undefined), { message: "Choose the stage", path: ["stage"] });
export type AutomationInput = z.infer<typeof automationInput>;

/**
 * The public enquiry form. `website` is a honeypot: people never see it, bots fill it in. `formToken` is
 * the signed time the page was served (src/server/rate-limit.ts).
 */
export const enquiryInput = z.strictObject({
  name: singleLine(TEXT.name),
  email: email,
  phone: phone.optional(),
  postcode: singleLine(12).optional(),
  projectType: singleLine(TEXT.short).optional(),
  budget: singleLine(TEXT.short).optional(),
  description: multiLine(TEXT.note).optional(),
  heardFrom: z.enum(LEAD_SOURCES).optional(),
  website: z.string().max(200).optional(),
  formToken: z.string().max(120).optional(),
  /** Sent by pages served before form tokens; ignored. */
  startedAt: z.int().optional(),
});

/** A one-off email to a lead from their page. */
export const leadEmailInput = z.strictObject({ subject: singleLine(TEXT.line), body: multiLine(4_000).pipe(z.string().min(1, "Write the email")) });

// ── Survey booking ───────────────────────────────────────────────────────────

export const surveySettingsInput = z.strictObject({
  enabled: z.boolean(),
  visitMinutes: z.int().min(15).max(480),
  bufferMinutes: z.int().min(0).max(240),
  minNoticeHours: z.int().min(0).max(336),
  maxDaysAhead: z.int().min(1).max(90),
  postcodes: z.array(z.string().regex(/^[A-Z]{1,2}(\d[A-Z\d]?)?$/)).max(100),
});

/** One person's week: windows in minutes past midnight, UK time. No overlaps within a day. */
export const surveyHoursInput = z.strictObject({
  memberId: id,
  windows: z
    .array(z.strictObject({ weekday: z.int().min(1).max(7), startMinute: z.int().min(0).max(1439), endMinute: z.int().min(1).max(1440) }))
    .max(28)
    .refine((ws) => ws.every((w) => w.startMinute < w.endMinute), "Each window must end after it starts")
    .refine(
      (ws) => ws.every((a, i) => ws.every((b, j) => i === j || a.weekday !== b.weekday || a.endMinute <= b.startMinute || b.endMinute <= a.startMinute)),
      "Two windows on the same day overlap",
    ),
});

/** The office books or moves a visit. */
export const bookSurveyInput = z.strictObject({
  startsAt: z.iso.datetime({ offset: true }),
  memberId: id.nullable(),
  minutes: z.int().min(15).max(480).optional(),
  emailClient: z.boolean(),
});

/** The client books online. */
export const clientBookingInput = z.strictObject({
  startsAt: z.iso.datetime({ offset: true }),
  phone: phone.optional(),
  addressLine: singleLine(TEXT.line).optional(),
  postcode: singleLine(12).optional(),
});
