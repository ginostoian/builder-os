/**
 * Figures read live from Xero for the Reports page: cash in the bank, the last 12 months' profit, money
 * owed, and profit per job (from the Jobs tracking category, so costs entered in Xero count too).
 */
import "server-only";
import { addDays, ukToday } from "@/core/payment-plan";
import { bankBalances, profitAndLoss, profitByOption, xeroDate } from "@/core/xero";
import { withTenant } from "@/db";
import { getXeroConnection } from "@/db/xero";
import { XeroApiError, XeroClient } from "./client";

export type XeroReport = {
  organisation: string;
  from: string;
  to: string;
  bank: { account: string; balance: number }[];
  pnl: ReturnType<typeof profitAndLoss>;
  owed: { total: number; overdue: number; count: number };
  jobs: { option: string; income: number; costs: number; profit: number }[] | null;
};

export async function xeroReport(orgId: string): Promise<XeroReport | { error: string } | null> {
  const conn = await withTenant(orgId, (tx) => getXeroConnection(tx, orgId));
  if (!conn?.settings) return null;
  const to = ukToday();
  const from = addDays(to, -364);
  const x = new XeroClient(orgId);
  try {
    const [bank, pnl, owed, jobs] = await Promise.all([
      x.request("GET", "/Reports/BankSummary", { query: { fromDate: from, toDate: to } }),
      x.request("GET", "/Reports/ProfitAndLoss", { query: { fromDate: from, toDate: to, standardLayout: "true" } }),
      x.request<{ Invoices?: { AmountDue: number; DueDate?: string }[] }>("GET", "/Invoices", {
        query: { where: 'Type=="ACCREC"&&Status=="AUTHORISED"', summaryOnly: "true", pageSize: "1000" },
      }),
      conn.settings.trackJobs && conn.settings.trackingCategoryId
        ? x.request("GET", "/Reports/ProfitAndLoss", { query: { fromDate: from, toDate: to, trackingCategoryID: conn.settings.trackingCategoryId, standardLayout: "true" } })
        : Promise.resolve(null),
    ]);
    const open = owed.Invoices ?? [];
    return {
      organisation: conn.tenantName,
      from,
      to,
      bank: bankBalances(bank),
      pnl: profitAndLoss(pnl),
      owed: {
        total: open.reduce((a, i) => a + Math.round(i.AmountDue * 100), 0),
        overdue: open.filter((i) => (xeroDate(i.DueDate) ?? to) < to).reduce((a, i) => a + Math.round(i.AmountDue * 100), 0),
        count: open.length,
      },
      jobs: jobs ? profitByOption(jobs).filter((j) => j.income !== 0 || j.costs !== 0) : null,
    };
  } catch (error) {
    if (error instanceof XeroApiError) return { error: error.message };
    throw error;
  }
}
