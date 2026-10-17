/**
 * Connecting to Xero and setting it up with sensible UK defaults, so most builders press Connect and are
 * done: the usual Sales account, their bank account, a Stripe account if they have one, a "Jobs" tracking
 * category for profit per job, and a number prefix if Xero already uses our invoice numbers.
 */
import "server-only";
import { JOBS_CATEGORY, xeroSettings, type XeroSettings } from "@/core/xero";
import { ukToday } from "@/core/payment-plan";
import { withTenant } from "@/db";
import { getXeroConnection, saveXeroConnection, saveXeroSettings } from "@/db/xero";
import { authEventOf, exchangeCode, listTenants, removeTenant, sealTokens, XeroClient } from "./client";

/** The Xero organisation is already connected to a different Builder OS company. */
export class XeroTakenError extends Error {}

type XAccount = { AccountID: string; Code?: string; Name: string; Type: string; Status: string; EnablePaymentsToAccount?: boolean };
type XCategory = { TrackingCategoryID: string; Name: string; Status: string; Options?: { Status: string }[] };
type XTaxRate = { TaxType: string; Status: string; Name: string };

/**
 * Finish connecting after Xero sends the person back: swap the code for tokens, keep the organisation they
 * picked (one per company), save the connection and set it up. Returns the organisation's name.
 */
export async function completeConnection(orgId: string, memberId: string, code: string, redirectUri: string): Promise<{ tenantName: string; extra: number }> {
  const tokens = await exchangeCode(code, redirectUri);
  const tenants = await listTenants(tokens.access_token);
  const event = authEventOf(tokens.access_token);
  const fresh = event ? tenants.filter((t) => t.authEventId === event) : [];
  const chosen = fresh[0] ?? tenants[0];
  if (!chosen) throw new Error("No Xero organisation was chosen.");
  // One Xero organisation per company: undo any others connected in the same step.
  const extras = fresh.slice(1);
  for (const t of extras) await removeTenant(tokens.access_token, t.id);
  try {
    await withTenant(orgId, (tx) =>
      saveXeroConnection(tx, orgId, { tenantId: chosen.tenantId, tenantName: chosen.tenantName, connectionId: chosen.id, memberId, ...sealTokens(tokens) }),
    );
  } catch (error) {
    const code = (error as { code?: string; cause?: { code?: string } }).cause?.code ?? (error as { code?: string }).code;
    if (code === "23505") throw new XeroTakenError();
    throw error;
  }
  await setUpDefaults(orgId);
  return { tenantName: chosen.tenantName, extra: extras.length };
}

/** Choose the settings a UK builder would, unless the company already set them for this organisation. */
async function setUpDefaults(orgId: string) {
  const conn = await withTenant(orgId, (tx) => getXeroConnection(tx, orgId));
  if (!conn) return;
  const x = new XeroClient(orgId);
  const org = (await x.request<{ Organisations?: { PaysTax?: boolean }[] }>("GET", "/Organisation")).Organisations?.[0];
  const vatRegistered = org?.PaysTax !== false;
  if (conn.settings) {
    await withTenant(orgId, (tx) => saveXeroSettings(tx, orgId, conn.settings!, vatRegistered));
    return;
  }
  const accounts = (await x.request<{ Accounts?: XAccount[] }>("GET", "/Accounts")).Accounts?.filter((a) => a.Status === "ACTIVE") ?? [];
  const sales = accounts.find((a) => a.Code === "200" && ["REVENUE", "SALES"].includes(a.Type)) ?? accounts.find((a) => ["REVENUE", "SALES"].includes(a.Type));
  const banks = accounts.filter((a) => a.Type === "BANK");
  const stripe = banks.find((a) => /stripe/i.test(a.Name));
  const bank = banks.find((a) => !/stripe|paypal|card/i.test(a.Name)) ?? banks.find((a) => a !== stripe);
  const trackingCategoryId = await jobsCategory(x).catch(() => undefined);
  const clash = await x
    .request<{ Invoices?: { InvoiceNumber?: string }[] }>("GET", "/Invoices", { query: { InvoiceNumbers: "INV-0001", summaryOnly: "true" } })
    .then((r) => Boolean(r.Invoices?.length))
    .catch(() => true);
  const settings: XeroSettings = xeroSettings.parse({
    salesAccountCode: sales?.Code ?? "200",
    bankAccountId: bank?.AccountID,
    stripeAccountId: stripe?.AccountID,
    invoiceStatus: "AUTHORISED",
    trackJobs: Boolean(trackingCategoryId),
    trackingCategoryId,
    syncFrom: ukToday(),
    pullPayments: true,
    numberPrefix: clash ? "BOS-" : "",
  });
  await withTenant(orgId, (tx) => saveXeroSettings(tx, orgId, settings, vatRegistered));
}

/** The "Jobs" tracking category: found, or made if there's room (Xero allows two active categories). */
async function jobsCategory(x: XeroClient): Promise<string | undefined> {
  const all = (await x.request<{ TrackingCategories?: XCategory[] }>("GET", "/TrackingCategories")).TrackingCategories ?? [];
  const found = all.find((c) => c.Status === "ACTIVE" && c.Name.toLowerCase() === JOBS_CATEGORY.toLowerCase());
  if (found) return found.TrackingCategoryID;
  if (all.filter((c) => c.Status === "ACTIVE").length >= 2) return undefined;
  const made = await x.request<{ TrackingCategories?: XCategory[] }>("PUT", "/TrackingCategories", { body: { Name: JOBS_CATEGORY } });
  return made.TrackingCategories?.[0]?.TrackingCategoryID;
}

export type XeroChoices = {
  salesAccounts: { code: string; name: string }[];
  bankAccounts: { id: string; name: string }[];
  categories: { id: string; name: string; options: number }[];
  /** The domestic reverse charge VAT rates are switched on in Xero. */
  reverseChargeReady: boolean;
};

/** What the settings form can choose from, read live from Xero. */
export async function xeroChoices(orgId: string): Promise<XeroChoices> {
  const x = new XeroClient(orgId);
  const [accounts, categories, rates] = await Promise.all([
    x.request<{ Accounts?: XAccount[] }>("GET", "/Accounts"),
    x.request<{ TrackingCategories?: XCategory[] }>("GET", "/TrackingCategories"),
    x.request<{ TaxRates?: XTaxRate[] }>("GET", "/TaxRates"),
  ]);
  const active = (accounts.Accounts ?? []).filter((a) => a.Status === "ACTIVE");
  return {
    salesAccounts: active.filter((a) => ["REVENUE", "SALES", "OTHERINCOME"].includes(a.Type) && a.Code).map((a) => ({ code: a.Code!, name: a.Name })),
    bankAccounts: active.filter((a) => a.Type === "BANK" || a.EnablePaymentsToAccount).map((a) => ({ id: a.AccountID, name: a.Name })),
    categories: (categories.TrackingCategories ?? [])
      .filter((c) => c.Status === "ACTIVE")
      .map((c) => ({ id: c.TrackingCategoryID, name: c.Name, options: (c.Options ?? []).filter((o) => o.Status === "ACTIVE").length })),
    reverseChargeReady: (rates.TaxRates ?? []).some((r) => r.TaxType === "DRCHARGESUPPLY20" && r.Status === "ACTIVE"),
  };
}

/** Add the Jobs category now (from settings, when it wasn't made at connect time). */
export const createJobsCategory = (orgId: string) => jobsCategory(new XeroClient(orgId));
