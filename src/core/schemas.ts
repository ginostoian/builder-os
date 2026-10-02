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
import { MAX_LINES_PER_QUOTE, MAX_MARKUP_BPS, MAX_PATCH_OPS, MAX_QTY, MAX_RATE_PENCE, MAX_VAT_BPS, QTY_DECIMALS, TEXT } from "./limits";

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

/**
 * Autosave patch from the quote grid (plan §4 "Request patterns"). The server applies ops in order,
 * inside one tenant transaction, and rejects the whole patch if `baseVersion` is stale.
 */
export const quotePatch = z.strictObject({
  quoteId: id,
  baseVersion: z.int().min(0),
  ops: z
    .array(
      z.discriminatedUnion("op", [
        z.strictObject({ op: z.literal("addSection"), sectionId: id, name: singleLine(TEXT.name), position }),
        z.strictObject({ op: z.literal("renameSection"), sectionId: id, name: singleLine(TEXT.name) }),
        z.strictObject({ op: z.literal("moveSection"), sectionId: id, position }),
        z.strictObject({ op: z.literal("removeSection"), sectionId: id }),
        z.strictObject({ op: z.literal("addLine"), sectionId: id, lineId: id, position, line: quoteLineInput }),
        z.strictObject({ op: z.literal("updateLine"), lineId: id, change: lineField }),
        z.strictObject({ op: z.literal("moveLine"), lineId: id, sectionId: id, position }),
        z.strictObject({ op: z.literal("removeLine"), lineId: id }),
      ]),
    )
    .min(1)
    .max(MAX_PATCH_OPS),
});
export type QuotePatch = z.infer<typeof quotePatch>;
