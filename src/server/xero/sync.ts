/**
 * Keeping Xero up to date. Builder OS pushes its invoices (with the client as a contact and the job as a
 * tracking option), the payments marked here, and voids. Xero sends back only payments: an invoice paid in
 * Xero is marked paid here. Every step reads Xero's copy first, so retries never create duplicates, and a
 * payment is never recorded twice (Xero's own, or a Stripe payout, already counts).
 */
import "server-only";
import { after } from "next/server";
import { createHash } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { planHas } from "@/core/plans";
import {
  trackingOptionName,
  whereString,
  xeroContact,
  xeroDate,
  xeroInvoice,
  xeroPayment,
  explainXeroError,
  nextAttemptAt,
  XeroMappingError,
  type XeroProblem,
  type XeroSettings,
} from "@/core/xero";
import { quoteRef } from "@/core/quote";
import { ukToday } from "@/core/payment-plan";
import { withTenant } from "@/db";
import { getInvoice, markPaid, InvoiceError } from "@/db/invoices";
import { clients, invoices, quotes } from "@/db/schema";
import { claimXeroJobs, failXeroJob, finishXeroJob, getXeroConnection, noteXeroSynced, queueXeroInvoice, removeXeroLink, setXeroLink, xeroLink } from "@/db/xero";
import { entitlementFor } from "../plan";
import { XeroApiError, XeroClient, xeroConfigured } from "./client";

type XInvoice = {
  InvoiceID: string;
  InvoiceNumber?: string;
  Status: string;
  Total: number;
  AmountDue: number;
  AmountPaid: number;
  FullyPaidOnDate?: string;
  HasErrors?: boolean;
  ValidationErrors?: unknown[];
};
type XContact = { ContactID: string; ContactStatus?: string };
type XCategory = { TrackingCategoryID: string; Name: string; Status: string; Options?: { TrackingOptionID: string; Name: string; Status: string }[] };

const toPence = (pounds: number | undefined) => Math.round((pounds ?? 0) * 100);
const hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex").slice(0, 24);

/** A problem someone has to fix in Xero or in Settings; retrying won't help until they do. */
class NeedsAction extends Error {}

/** Whether a company can use Xero now: the server is set up, it's connected and set up, and its plan has invoicing. */
async function ready(orgId: string) {
  if (!xeroConfigured()) return null;
  return withTenant(orgId, async (tx) => {
    const conn = await getXeroConnection(tx, orgId);
    if (!conn?.settings || conn.status !== "active") return null;
    if (!planHas((await entitlementFor(tx, orgId)).plan, "invoicing")) return null;
    return { settings: conn.settings, vatRegistered: conn.vatRegistered };
  });
}

// ── Contacts and tracking ────────────────────────────────────────────────────

async function findContact(x: XeroClient, where: string): Promise<string | null> {
  const r = await x.request<{ Contacts?: XContact[] }>("GET", "/Contacts", { query: { where, summaryOnly: "true" } });
  const found = r.Contacts?.find((c) => c.ContactStatus !== "ARCHIVED") ?? r.Contacts?.[0];
  return found?.ContactID ?? null;
}

/** The client's Xero contact: the one we made before, one already in Xero with their email or name, or a new one. */
async function ensureContact(
  x: XeroClient,
  orgId: string,
  client: { id: string; name: string; email: string | null; phone: string | null; address: { line1: string; line2?: string; town: string; postcode: string } | null },
) {
  const linked = await withTenant(orgId, (tx) => xeroLink(tx, orgId, "contact", client.id));
  if (linked) return linked;
  let id =
    (await findContact(x, `ContactNumber==${whereString(client.id)}`)) ??
    (client.email ? await findContact(x, `EmailAddress==${whereString(client.email)}`) : null) ??
    (await findContact(x, `Name==${whereString(client.name)}`));
  if (!id) {
    try {
      const r = await x.request<{ Contacts?: XContact[] }>("PUT", "/Contacts", { body: { Contacts: [xeroContact(client)] }, idempotencyKey: `bos-contact-${client.id}` });
      id = r.Contacts?.[0]?.ContactID ?? null;
    } catch (error) {
      // Another contact already has the name (perhaps archived): use it.
      if (error instanceof XeroApiError && error.status === 400) id = await findContact(x, `Name==${whereString(client.name)}`);
      if (!id) throw error;
    }
  }
  if (!id) throw new XeroApiError(502, { error: "Xero didn't return the new contact." });
  await withTenant(orgId, (tx) => setXeroLink(tx, orgId, "contact", client.id, id));
  return id;
}

/** The job's option in the Jobs tracking category, made if it's new. Tracking is a nicety: if it fails, the invoice still goes. */
async function ensureTracking(
  x: XeroClient,
  orgId: string,
  settings: XeroSettings,
  quote: { id: string; number: number; title: string } | null,
  cache: Map<string, XCategory | null>,
) {
  if (!settings.trackJobs || !settings.trackingCategoryId || !quote) return undefined;
  try {
    if (!cache.has(settings.trackingCategoryId)) {
      const r = await x.request<{ TrackingCategories?: XCategory[] }>("GET", `/TrackingCategories/${settings.trackingCategoryId}`);
      cache.set(settings.trackingCategoryId, r.TrackingCategories?.[0] ?? null);
    }
    const cat = cache.get(settings.trackingCategoryId);
    if (!cat || cat.Status !== "ACTIVE") return undefined;
    const active = (cat.Options ?? []).filter((o) => o.Status === "ACTIVE");
    const linked = await withTenant(orgId, (tx) => xeroLink(tx, orgId, "tracking", quote.id));
    const mine = linked ? active.find((o) => o.TrackingOptionID === linked) : undefined;
    if (mine) return { name: cat.Name, option: mine.Name };
    const name = trackingOptionName(quoteRef(quote.number), quote.title);
    let option = active.find((o) => o.Name.toLowerCase() === name.toLowerCase());
    if (!option) {
      const r = await x.request<{ Options?: { TrackingOptionID: string; Name: string; Status: string }[] }>("PUT", `/TrackingCategories/${cat.TrackingCategoryID}/Options`, {
        body: { Name: name },
      });
      option = r.Options?.[0];
      if (option) cat.Options = [...(cat.Options ?? []), option];
    }
    if (!option) return undefined;
    await withTenant(orgId, (tx) => setXeroLink(tx, orgId, "tracking", quote.id, option.TrackingOptionID));
    return { name: cat.Name, option: option.Name };
  } catch {
    return undefined;
  }
}

async function xeroInvoiceById(x: XeroClient, id: string): Promise<XInvoice | null> {
  const r = await x.request<{ Invoices?: XInvoice[] }>("GET", `/Invoices/${id}`);
  return r.Invoices?.[0] ?? null;
}

// ── Pushing one invoice ──────────────────────────────────────────────────────

/**
 * Make Xero match one of our invoices as it is now: create it if it isn't there, record a payment marked
 * here, remove a payment we recorded if it's been marked unpaid, and void it if it's been voided. Returns
 * a note for the sync log when something's worth knowing but needs no action.
 */
export async function pushInvoice(orgId: string, invoiceId: string, cache = new Map<string, XCategory | null>()): Promise<string | null> {
  const setup = await ready(orgId);
  if (!setup) return "Xero isn't connected.";
  const { settings } = setup;
  const data = await withTenant(orgId, async (tx) => {
    const inv = await getInvoice(tx, orgId, invoiceId);
    if (!inv) return null;
    const [client] = await tx
      .select({ id: clients.id, name: clients.name, email: clients.email, phone: clients.phone, address: clients.address })
      .from(clients)
      .where(and(eq(clients.orgId, orgId), eq(clients.id, inv.clientId)));
    const [quote] = inv.quoteId
      ? await tx
          .select({ id: quotes.id, number: quotes.number, title: quotes.title })
          .from(quotes)
          .where(and(eq(quotes.orgId, orgId), eq(quotes.id, inv.quoteId)))
      : [];
    return { inv, client, quote: quote ?? null, xeroId: await xeroLink(tx, orgId, "invoice", invoiceId), paymentId: await xeroLink(tx, orgId, "payment", invoiceId) };
  });
  if (!data) return "The invoice no longer exists.";
  const { inv, client, quote } = data;
  if (inv.issueDate < settings.syncFrom) return `Issued before ${settings.syncFrom}, when you started sending invoices to Xero.`;
  const x = new XeroClient(orgId);
  const number = `${settings.numberPrefix}${inv.snapshot.ref}`;

  let xeroId = data.xeroId;
  if (!xeroId) {
    if (inv.status === "void") return "Voided before it reached Xero, so there's nothing to send.";
    // It may be there already: a reply that never arrived, or someone typed it into Xero.
    const existing = await x.request<{ Invoices?: XInvoice[] }>("GET", "/Invoices", { query: { InvoiceNumbers: number, Statuses: "DRAFT,SUBMITTED,AUTHORISED,PAID" } });
    const same = existing.Invoices?.find((i) => i.InvoiceNumber === number);
    if (same) {
      if (Math.abs(toPence(same.Total) - inv.totalPence) > 1)
        throw new NeedsAction(
          `Xero already has an invoice numbered ${number} for a different amount. In Settings, Xero, set a number prefix (like BOS-) so ours don't clash, then press Retry.`,
        );
      xeroId = same.InvoiceID;
    } else {
      const contactId = await ensureContact(x, orgId, client);
      const tracking = await ensureTracking(x, orgId, settings, quote, cache);
      const s = inv.snapshot;
      const body = xeroInvoice(
        {
          ref: s.ref,
          issueDate: inv.issueDate,
          dueDate: inv.dueDate,
          description: s.description,
          quote: s.quote,
          vatRateBps: s.vatRateBps,
          vatTreatment: s.vatTreatment,
          lines: s.lines ?? [{ description: s.description, net: inv.netPence, vat: inv.vatPence }],
        },
        { contactId, numberPrefix: settings.numberPrefix, accountCode: settings.salesAccountCode, status: settings.invoiceStatus, vatRegistered: setup.vatRegistered, tracking },
      );
      const r = await x.request<{ Invoices?: XInvoice[] }>("PUT", "/Invoices", {
        body: { Invoices: [body] },
        query: { summarizeErrors: "false" },
        idempotencyKey: `bos-inv-${inv.id}-${hash(body)}`,
      });
      const created = r.Invoices?.[0];
      if (!created?.InvoiceID || created.HasErrors || created.ValidationErrors?.length) throw new XeroApiError(400, r);
      xeroId = created.InvoiceID;
    }
    await withTenant(orgId, (tx) => setXeroLink(tx, orgId, "invoice", invoiceId, xeroId!));
  }

  let xi = await xeroInvoiceById(x, xeroId);
  if (!xi) throw new XeroApiError(404, { error: "Xero didn't return the invoice." });
  const notes: string[] = [];

  // Voided here: take off any payment we recorded, then void (or delete a draft) in Xero.
  if (inv.status === "void") {
    if (xi.Status === "VOIDED" || xi.Status === "DELETED") return null;
    if (data.paymentId) {
      await deletePayment(x, orgId, invoiceId, data.paymentId);
      xi = (await xeroInvoiceById(x, xeroId)) ?? xi;
    }
    if (xi.AmountPaid > 0) throw new NeedsAction(`${number} has a payment in Xero, so Xero won't void it. Remove the payment in Xero first, then press Retry.`);
    const status = xi.Status === "DRAFT" || xi.Status === "SUBMITTED" ? "DELETED" : "VOIDED";
    await x.request("POST", `/Invoices/${xeroId}`, { body: { InvoiceID: xeroId, Status: status } });
    return null;
  }
  if (xi.Status === "VOIDED" || xi.Status === "DELETED")
    throw new NeedsAction(`${number} was voided or deleted in Xero but is still open here. Void it here too, or raise it again.`);

  if (inv.status === "paid") {
    if (xi.AmountDue <= 0) return null; // Already paid in Xero (there, or by us before).
    if (xi.Status !== "AUTHORISED") throw new NeedsAction(`${number} is still a draft in Xero. Approve it in Xero, then press Retry to record the payment.`);
    const online = Boolean(inv.stripePaymentId);
    const accountId = online && settings.stripeAccountId ? settings.stripeAccountId : settings.bankAccountId;
    if (!accountId) return "Paid here, but no bank account is chosen in Settings, Xero, so record the payment in Xero.";
    const payment = xeroPayment({
      invoiceId: xeroId,
      accountId,
      date: inv.paidOn ?? ukToday(),
      amountPence: toPence(xi.AmountDue),
      reference: inv.paidReference ?? (online ? "Paid online (Stripe)" : inv.snapshot.ref),
    });
    const r = await x.request<{ Payments?: { PaymentID: string; HasErrors?: boolean }[] }>("PUT", "/Payments", {
      body: { Payments: [payment] },
      query: { summarizeErrors: "false" },
      idempotencyKey: `bos-pay-${inv.id}-${hash(payment)}`,
    });
    const paid = r.Payments?.[0];
    if (!paid?.PaymentID || paid.HasErrors) throw new XeroApiError(400, r);
    await withTenant(orgId, (tx) => setXeroLink(tx, orgId, "payment", invoiceId, paid.PaymentID));
    if (online && !settings.stripeAccountId)
      notes.push("Paid online: recorded against your bank account. Choose a Stripe account in Settings, Xero, so the Stripe payout isn't counted twice.");
  } else if (data.paymentId) {
    // Marked unpaid here: take off the payment we recorded. Payments made in Xero are left alone.
    await deletePayment(x, orgId, invoiceId, data.paymentId);
  } else if (xi.AmountPaid > 0 && xi.AmountDue <= 0) {
    notes.push("It's paid in Xero but open here. If it really is paid, mark it paid here.");
  }

  if (Math.abs(toPence(xi.Total) - inv.totalPence) > 1)
    notes.push(`Xero's total is £${xi.Total.toFixed(2)}, ours is £${(inv.totalPence / 100).toFixed(2)}. Check the VAT rates in Xero.`);
  return notes.join(" ") || null;
}

async function deletePayment(x: XeroClient, orgId: string, invoiceId: string, paymentId: string) {
  try {
    await x.request("POST", `/Payments/${paymentId}`, { body: { Status: "DELETED" } });
  } catch (error) {
    // Already deleted in Xero is fine.
    if (!(error instanceof XeroApiError && error.status === 404)) throw error;
  }
  await withTenant(orgId, (tx) => removeXeroLink(tx, orgId, "payment", invoiceId));
}

// ── Pulling payments ─────────────────────────────────────────────────────────

/**
 * Invoices paid in Xero are marked paid here (from a webhook, or the daily check). Only invoices that are
 * open here and fully paid in Xero; the payment date comes from Xero.
 */
export async function pullPayments(orgId: string, invoiceIds?: string[]): Promise<number> {
  const setup = await ready(orgId);
  if (!setup?.settings.pullPayments) return 0;
  const open = await withTenant(orgId, async (tx) => {
    const rows = await tx
      .select({ id: invoices.id })
      .from(invoices)
      .where(and(eq(invoices.orgId, orgId), eq(invoices.status, "issued"), invoiceIds ? inArray(invoices.id, invoiceIds) : undefined))
      .limit(500);
    const linked: { id: string; xeroId: string }[] = [];
    for (const r of rows) {
      const xeroId = await xeroLink(tx, orgId, "invoice", r.id);
      if (xeroId) linked.push({ id: r.id, xeroId });
    }
    return linked;
  });
  if (open.length === 0) return 0;
  const x = new XeroClient(orgId);
  let marked = 0;
  for (let i = 0; i < open.length; i += 50) {
    const batch = open.slice(i, i + 50);
    const r = await x.request<{ Invoices?: XInvoice[] }>("GET", "/Invoices", { query: { IDs: batch.map((b) => b.xeroId).join(","), summaryOnly: "true" } });
    for (const xi of r.Invoices ?? []) {
      if (xi.Status !== "PAID" || xi.AmountDue > 0) continue;
      const local = batch.find((b) => b.xeroId === xi.InvoiceID);
      if (!local) continue;
      const paidOn = xeroDate(xi.FullyPaidOnDate) ?? ukToday();
      const done = await withTenant(orgId, (tx) =>
        markPaid(tx, orgId, local.id, paidOn > ukToday() ? ukToday() : paidOn, "Paid (recorded in Xero)").then(
          () => true,
          (e) => (e instanceof InvoiceError ? false : Promise.reject(e)),
        ),
      );
      if (done) marked++;
    }
  }
  return marked;
}

// ── Running the queue ────────────────────────────────────────────────────────

function problemOf(error: unknown): XeroProblem & { retryAfter?: number } {
  if (error instanceof NeedsAction || error instanceof XeroMappingError) return { message: error.message, needsAction: true };
  if (error instanceof XeroApiError) return { ...explainXeroError(error.status, error.body), retryAfter: error.retryAfterSeconds };
  return { message: "Something went wrong reaching Xero. We'll try again shortly.", needsAction: false };
}

/** Work through a company's due Xero jobs (a few at a time, to stay inside Xero's limits). */
export async function runXeroSync(orgId: string, limit = 20): Promise<{ done: number; failed: number }> {
  if (!(await ready(orgId))) return { done: 0, failed: 0 };
  const jobs = await withTenant(orgId, (tx) => claimXeroJobs(tx, orgId, new Date(), limit));
  const cache = new Map<string, XCategory | null>();
  let done = 0;
  let failed = 0;
  let lastError: string | null = null;
  for (const job of jobs) {
    try {
      const note = await pushInvoice(orgId, job.invoiceId, cache);
      await withTenant(orgId, (tx) => finishXeroJob(tx, orgId, job.id, note));
      done++;
    } catch (error) {
      const p = problemOf(error);
      if (!(error instanceof XeroApiError || error instanceof NeedsAction || error instanceof XeroMappingError)) console.error("Xero sync failed", error);
      const attempts = job.attempts + 1;
      const retryAt = p.needsAction ? null : nextAttemptAt(attempts, new Date(), p.retryAfter);
      await withTenant(orgId, (tx) => failXeroJob(tx, orgId, job.id, attempts, p.message, retryAt));
      failed++;
      lastError = p.message;
      // No point carrying on: every job would fail the same way.
      if (p.reconnect || (error instanceof XeroApiError && error.status === 429)) break;
    }
  }
  if (jobs.length) await withTenant(orgId, (tx) => noteXeroSynced(tx, orgId, lastError));
  return { done, failed };
}

/** Queue an invoice for Xero and, if the company uses Xero, push it straight away (call from `after()`). */
export async function queueForXero(orgId: string, invoiceId: string) {
  if (!xeroConfigured()) return;
  const queued = await withTenant(orgId, (tx) => queueXeroInvoice(tx, orgId, invoiceId));
  if (queued) await runXeroSync(orgId, 5);
}

/**
 * Queue and push an invoice once the response has gone (`after()`), so the person never waits on Xero.
 * Outside a request (a script, a test) it runs straight away. Errors are logged, never thrown.
 */
export function xeroLater(orgId: string, invoiceId: string) {
  if (!xeroConfigured()) return;
  const run = () => queueForXero(orgId, invoiceId).catch((error) => console.error("Xero sync failed", error instanceof Error ? error.message : error));
  try {
    after(run);
  } catch {
    void run();
  }
}

