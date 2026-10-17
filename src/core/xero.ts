/**
 * Xero: the rules for turning Builder OS records into Xero ones, and Xero's answers into plain English.
 * Pure, so every payload and message is unit tested. The HTTP side lives in src/server/xero.
 *
 * Builder OS owns quotes, jobs, stage payments and the invoice the client sees; Xero owns the ledger (bank
 * reconciliation, VAT and CIS returns). So invoices, contacts and payments go one way, to Xero, and come
 * back only as status: a payment recorded in Xero marks the invoice paid here.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { VatTreatment } from "./vat";

export const XERO_AUTHORIZE_URL = "https://login.xero.com/identity/connect/authorize";
export const XERO_TOKEN_URL = "https://identity.xero.com/connect/token";
export const XERO_REVOKE_URL = "https://identity.xero.com/connect/revocation";
export const XERO_CONNECTIONS_URL = "https://api.xero.com/connections";
export const XERO_API = "https://api.xero.com/api.xro/2.0";

/**
 * Granular scopes (apps created after 2 March 2026 can't ask for the old broad ones). Settings is write
 * access only so we can add the "Jobs" tracking category for per-job profit.
 */
export const XERO_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "accounting.contacts",
  "accounting.invoices",
  "accounting.payments",
  "accounting.settings",
  "accounting.reports.profitandloss.read",
  "accounting.reports.banksummary.read",
] as const;

/** Access tokens last 30 minutes; refresh a little early. */
export const TOKEN_REFRESH_MARGIN_MS = 2 * 60_000;
/** Most attempts at one sync job before it waits for someone to press Retry. */
export const MAX_SYNC_ATTEMPTS = 6;
/** Xero allows about 100 active options in a tracking category. */
export const MAX_TRACKING_OPTIONS = 100;
export const JOBS_CATEGORY = "Jobs";

// ── Settings ─────────────────────────────────────────────────────────────────

export const xeroSettings = z.strictObject({
  /** Where sales go, e.g. "200" (Sales). */
  salesAccountCode: z.string().trim().min(1).max(10),
  /** The bank account payments marked here are recorded against. */
  bankAccountId: z.uuid().optional(),
  /** A Stripe clearing account for online payments, so the Stripe payout isn't counted twice. */
  stripeAccountId: z.uuid().optional(),
  /** AUTHORISED (ready to be paid and reconciled) or DRAFT (for your accountant to approve first). */
  invoiceStatus: z.enum(["AUTHORISED", "DRAFT"]).default("AUTHORISED"),
  /** Tag each invoice with its job, for profit per job in Xero. */
  trackJobs: z.boolean().default(true),
  trackingCategoryId: z.uuid().optional(),
  /** Send invoices issued on or after this date (YYYY-MM-DD). */
  syncFrom: z.iso.date(),
  /** Mark invoices paid here when they're paid in Xero. */
  pullPayments: z.boolean().default(true),
  /**
   * Put before our invoice numbers in Xero ("BOS-" makes INV-0001 into BOS-INV-0001), for a Xero that
   * already has its own INV-0001. Searching INV-0001 in Xero still finds it.
   */
  numberPrefix: z
    .string()
    .trim()
    .max(10)
    .regex(/^[A-Za-z0-9-]*$/)
    .default(""),
});
export type XeroSettings = z.infer<typeof xeroSettings>;

// ── VAT ──────────────────────────────────────────────────────────────────────

/**
 * Xero's UK tax type for a sales line. The domestic reverse charge has its own codes, which a Xero
 * organisation must switch on first (Accounting, Advanced, Tax rates). Not VAT registered: no VAT.
 */
export function salesTaxType(rateBps: number, treatment: VatTreatment | undefined, vatRegistered: boolean): string | null {
  if (!vatRegistered) return "NONE";
  if (treatment === "reverse_charge") return rateBps === 2000 ? "DRCHARGESUPPLY20" : rateBps === 500 ? "DRCHARGESUPPLY5" : null;
  if (rateBps === 2000) return "OUTPUT2";
  if (rateBps === 500) return "RROUTPUT";
  if (rateBps === 0) return "ZERORATEDOUTPUT";
  return null;
}

export const DRC_TAX_TYPES = new Set(["DRCHARGESUPPLY20", "DRCHARGESUPPLY5"]);

// ── Payloads ─────────────────────────────────────────────────────────────────

/** Pence → pounds with two decimals, as Xero wants. */
export const pounds = (pence: number) => Math.round(pence) / 100;

export type XeroInvoiceSource = {
  ref: string;
  issueDate: string;
  dueDate: string;
  description: string;
  quote: { ref: string; title: string } | null;
  vatRateBps: number;
  vatTreatment?: VatTreatment;
  lines: { description: string; net: number; vat: number }[];
};

export type XeroInvoiceContext = {
  contactId: string;
  numberPrefix?: string;
  accountCode: string;
  status: "AUTHORISED" | "DRAFT";
  vatRegistered: boolean;
  /** Link back to the invoice in Builder OS. */
  url?: string;
  tracking?: { name: string; option: string };
};

export class XeroMappingError extends Error {}

/**
 * A Builder OS invoice as a Xero sales invoice. Amounts are net with VAT given per line (so Xero's VAT
 * matches ours to the penny); reverse charge lines carry no VAT. The invoice number is ours, so the
 * client's reference matches in both places and a retry can't create a second one.
 */
export function xeroInvoice(src: XeroInvoiceSource, ctx: XeroInvoiceContext) {
  const taxType = salesTaxType(src.vatRateBps, src.vatTreatment, ctx.vatRegistered);
  if (!taxType) throw new XeroMappingError(`There's no Xero VAT rate for ${src.vatRateBps / 100}%.`);
  const reference = src.quote ? `${src.quote.ref} ${src.quote.title}` : src.description;
  return {
    Type: "ACCREC",
    Contact: { ContactID: ctx.contactId },
    InvoiceNumber: `${ctx.numberPrefix ?? ""}${src.ref}`,
    Reference: reference.slice(0, 255),
    Date: src.issueDate,
    DueDate: src.dueDate,
    LineAmountTypes: "Exclusive",
    Status: ctx.status,
    ...(ctx.url ? { Url: ctx.url } : {}),
    LineItems: src.lines.map((l) => ({
      Description: l.description.slice(0, 4000),
      Quantity: 1,
      UnitAmount: pounds(l.net),
      AccountCode: ctx.accountCode,
      TaxType: taxType,
      // Our VAT to the penny (none on a reverse charge or non-VAT line), so both totals agree.
      TaxAmount: pounds(l.vat),
      ...(ctx.tracking ? { Tracking: [{ Name: ctx.tracking.name, Option: ctx.tracking.option }] } : {}),
    })),
  };
}

export type XeroContactSource = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: { line1: string; line2?: string; town: string; postcode: string } | null;
};

/** A client as a Xero contact. ContactNumber holds our id, so we can always find it again. */
export function xeroContact(c: XeroContactSource) {
  return {
    Name: c.name.slice(0, 255),
    ContactNumber: c.id,
    ...(c.email ? { EmailAddress: c.email } : {}),
    ...(c.address
      ? {
          Addresses: [
            {
              AddressType: "POBOX",
              AddressLine1: c.address.line1,
              ...(c.address.line2 ? { AddressLine2: c.address.line2 } : {}),
              City: c.address.town,
              PostalCode: c.address.postcode,
              Country: "United Kingdom",
            },
          ],
        }
      : {}),
    ...(c.phone ? { Phones: [{ PhoneType: "DEFAULT", PhoneNumber: c.phone }] } : {}),
  };
}

export function xeroPayment(p: { invoiceId: string; accountId: string; date: string; amountPence: number; reference: string }) {
  return { Invoice: { InvoiceID: p.invoiceId }, Account: { AccountID: p.accountId }, Date: p.date, Amount: pounds(p.amountPence), Reference: p.reference.slice(0, 255) };
}

/** A job's tracking option: its quote reference and title, within Xero's 100 characters. */
export const trackingOptionName = (quoteRef: string, title: string) => `${quoteRef} ${title}`.replace(/\s+/g, " ").trim().slice(0, 100);

/** A `where` filter value for Xero: double quotes escaped. */
export const whereString = (s: string) => `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

/** Xero's dates ("/Date(1760659200000+0000)/" or "2026-10-17T00:00:00") as YYYY-MM-DD in UK time. */
export function xeroDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const ms = /^\/Date\((-?\d+)([+-]\d{4})?\)\/$/.exec(value)?.[1];
  const d = ms ? new Date(Number(ms)) : /^\d{4}-\d{2}-\d{2}/.test(value) ? new Date(`${value.slice(0, 10)}T12:00:00Z`) : null;
  if (!d || Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(d);
}

// ── Webhooks ─────────────────────────────────────────────────────────────────

/** Xero signs the raw body: base64(HMAC-SHA256(body, webhook key)). Compared in constant time. */
export function validWebhookSignature(rawBody: string, signature: string | null, key: string): boolean {
  if (!signature || !key) return false;
  const expected = Buffer.from(createHmac("sha256", key).update(rawBody, "utf8").digest("base64"));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export const webhookPayload = z.object({
  events: z
    .array(
      z.object({
        resourceId: z.string(),
        tenantId: z.string(),
        eventCategory: z.string(),
        eventType: z.string(),
      }),
    )
    .max(500),
});

// ── Plain-English errors ─────────────────────────────────────────────────────

export type XeroProblem = { message: string; /** Retrying won't help until someone changes something. */ needsAction: boolean; reconnect?: boolean };

/** Turn what Xero said into something a builder can act on. */
export function explainXeroError(status: number, body: unknown): XeroProblem {
  const text = validationMessages(body).join(" ") || (typeof body === "string" ? body : JSON.stringify(body ?? ""));
  if (status === 401 || /invalid_grant|token.*(expired|invalid)|AuthenticationUnsuccessful/i.test(text))
    return { message: "Xero needs you to connect again (the link expires after 60 days without use). Open Settings, Xero and press Connect.", needsAction: true, reconnect: true };
  if (status === 403) return { message: "Xero refused access. Connect again and allow all the permissions Builder OS asks for.", needsAction: true, reconnect: true };
  if (status === 429) return { message: "Xero asked us to slow down. We'll try again shortly.", needsAction: false };
  if (status >= 500) return { message: "Xero isn't answering right now. We'll try again shortly.", needsAction: false };
  if (/DRCHARGE/i.test(text))
    return {
      message:
        "Switch on Xero's domestic reverse charge VAT rates: in Xero go to Accounting, Advanced, Tax rates, and choose Add Domestic Reverse Charge Tax Rates. Then press Retry.",
      needsAction: true,
    };
  if (/TaxType|tax rate/i.test(text))
    return { message: `Xero didn't accept the VAT rate. Check your VAT settings in Xero, then press Retry. (Xero said: ${short(text)})`, needsAction: true };
  if (/Account code .* (is not a valid|has been archived)|AccountCode/i.test(text))
    return { message: "Your sales account in Xero has changed. Choose it again in Settings, Xero, then press Retry.", needsAction: true };
  if (/lock date|period.*locked|end of year lock/i.test(text))
    return {
      message: "That date is before your Xero lock date (your accountant has closed that period). Ask them to move the lock date, or record it in Xero by hand.",
      needsAction: true,
    };
  if (/Payments can only be made|Authorised/i.test(text))
    return { message: "The invoice is still a draft in Xero. Approve it in Xero, then press Retry to record the payment.", needsAction: true };
  if (/Account.*(payments|bank)|EnablePaymentsToAccount/i.test(text))
    return { message: "Payments can't go to that account. Choose a bank account in Settings, Xero.", needsAction: true };
  if (/TrackingCategory|tracking/i.test(text))
    return { message: "Xero didn't accept the job tracking. Check the Jobs tracking category in Xero (it can hold about 100 active jobs; archive old ones).", needsAction: true };
  return { message: `Xero didn't accept it: ${short(text) || `error ${status}`}`, needsAction: true };
}

const short = (s: string) => (s.length > 220 ? `${s.slice(0, 217)}…` : s);

/** Xero's validation messages, wherever they are in the response. */
export function validationMessages(body: unknown): string[] {
  const out: string[] = [];
  const walk = (v: unknown, depth: number) => {
    if (depth > 6 || !v || typeof v !== "object") return;
    if (Array.isArray(v)) return v.forEach((x) => walk(x, depth + 1));
    const o = v as Record<string, unknown>;
    if (Array.isArray(o.ValidationErrors))
      for (const e of o.ValidationErrors) if (e && typeof (e as { Message?: unknown }).Message === "string") out.push((e as { Message: string }).Message);
    if (typeof o.Detail === "string") out.push(o.Detail);
    if (typeof o.error === "string") out.push(o.error);
    for (const k of Object.keys(o)) if (k !== "ValidationErrors") walk(o[k], depth + 1);
  };
  walk(body, 0);
  return [...new Set(out)];
}

// ── Reports ──────────────────────────────────────────────────────────────────

type ReportCell = { Value?: string };
type ReportRow = { RowType?: string; Title?: string; Cells?: ReportCell[]; Rows?: ReportRow[] };

/** Every labelled row of a Xero report as label → amount (first value column), in pence. */
export function reportFigures(report: unknown): Map<string, number> {
  const figures = new Map<string, number>();
  const rows = ((report as { Reports?: { Rows?: ReportRow[] }[] })?.Reports?.[0]?.Rows ?? []) as ReportRow[];
  const walk = (list: ReportRow[]) => {
    for (const r of list) {
      if (r.Rows) walk(r.Rows);
      const [label, value] = r.Cells ?? [];
      const n = Number(String(value?.Value ?? "").replace(/,/g, ""));
      if (label?.Value && value?.Value !== undefined && value.Value !== "" && Number.isFinite(n)) figures.set(label.Value.trim(), Math.round(n * 100));
    }
  };
  walk(rows);
  return figures;
}

const pick = (f: Map<string, number>, ...patterns: RegExp[]) => {
  for (const p of patterns) for (const [k, v] of f) if (p.test(k)) return v;
  return null;
};

/** Income, direct costs, overheads and profit from a Profit and Loss report. */
export function profitAndLoss(report: unknown) {
  const f = reportFigures(report);
  const income = pick(f, /^Total (Trading )?Income$/i, /^Total Revenue$/i) ?? 0;
  const costOfSales = pick(f, /^Total Cost of Sales$/i, /^Total Direct Costs$/i) ?? 0;
  const overheads = pick(f, /^Total Operating Expenses$/i, /^Total Overheads$/i, /^Total Expenses$/i) ?? 0;
  const gross = pick(f, /^Gross Profit$/i) ?? income - costOfSales;
  const net = pick(f, /^Net Profit$/i, /^Net (Income|Loss)$/i) ?? gross - overheads;
  return { income, costOfSales, grossProfit: gross, overheads, netProfit: net };
}

/**
 * Profit and Loss split by a tracking category (one column per option, then a total): income, direct
 * costs, overheads and profit for each job, in pence. The "Unassigned" column holds what isn't tagged.
 */
export function profitByOption(report: unknown): { option: string; income: number; costs: number; profit: number }[] {
  const rows = ((report as { Reports?: { Rows?: ReportRow[] }[] })?.Reports?.[0]?.Rows ?? []) as ReportRow[];
  const header = rows.find((r) => r.RowType === "Header")?.Cells?.map((c) => c.Value?.trim() ?? "") ?? [];
  const columns = header.map((name, i) => ({ name, i })).filter((c) => c.i > 0 && c.name && !/^total$/i.test(c.name));
  const byLabel = new Map<string, number[]>();
  const walk = (list: ReportRow[]) => {
    for (const r of list) {
      if (r.Rows) walk(r.Rows);
      const label = r.Cells?.[0]?.Value?.trim();
      if (label)
        byLabel.set(
          label,
          (r.Cells ?? []).map((c) => Math.round(Number(String(c.Value ?? "0").replace(/,/g, "") || 0) * 100)),
        );
    }
  };
  walk(rows);
  const find = (...patterns: RegExp[]) => {
    for (const p of patterns) for (const [k, v] of byLabel) if (p.test(k)) return v;
    return null;
  };
  const income = find(/^Total (Trading )?Income$/i, /^Total Revenue$/i);
  const cos = find(/^Total Cost of Sales$/i, /^Total Direct Costs$/i);
  const opex = find(/^Total Operating Expenses$/i, /^Total Overheads$/i, /^Total Expenses$/i);
  const net = find(/^Net Profit$/i, /^Net (Income|Loss)$/i);
  return columns.map(({ name, i }) => {
    const inc = income?.[i] ?? 0;
    const costs = (cos?.[i] ?? 0) + (opex?.[i] ?? 0);
    return { option: name, income: inc, costs, profit: net?.[i] ?? inc - costs };
  });
}

/** Closing balances by bank account from a Bank Summary report, in pence. */
export function bankBalances(report: unknown): { account: string; balance: number }[] {
  const rows = ((report as { Reports?: { Rows?: ReportRow[] }[] })?.Reports?.[0]?.Rows ?? []) as ReportRow[];
  const out: { account: string; balance: number }[] = [];
  for (const section of rows) {
    for (const r of section.Rows ?? []) {
      if (r.RowType !== "Row" || !r.Cells?.length) continue;
      const name = r.Cells[0]?.Value?.trim();
      const closing = Number(String(r.Cells.at(-1)?.Value ?? "").replace(/,/g, ""));
      if (name && Number.isFinite(closing)) out.push({ account: name, balance: Math.round(closing * 100) });
    }
  }
  return out;
}

// ── Retry timing ─────────────────────────────────────────────────────────────

/** When to try a failed job again: 1, 5, 30 minutes, then 2 and 12 hours. Null once it's out of tries. */
export function nextAttemptAt(attempts: number, now: Date, retryAfterSeconds?: number): Date | null {
  if (attempts >= MAX_SYNC_ATTEMPTS) return null;
  const minutes = [1, 5, 30, 120, 720][Math.min(attempts - 1, 4)] ?? 720;
  const wait = Math.max(minutes * 60_000, (retryAfterSeconds ?? 0) * 1000);
  return new Date(now.getTime() + wait);
}
