/** The daily Xero run: retry what's due, and mark paid anything that's been paid in Xero (in case a webhook was missed). */
import "server-only";
import { findOrgsWithDueXeroJobs, findOrgsWithXero, withTenant } from "@/db";
import { pruneXeroJobs } from "@/db/xero";
import { xeroConfigured } from "./client";
import { pullPayments, runXeroSync } from "./sync";

export async function runXeroDaily(): Promise<{ companies: number; sent: number; failed: number; markedPaid: number }> {
  const out = { companies: 0, sent: 0, failed: 0, markedPaid: 0 };
  if (!xeroConfigured()) return out;
  const due = new Set(await findOrgsWithDueXeroJobs(new Date()));
  for (const orgId of await findOrgsWithXero()) {
    out.companies++;
    try {
      if (due.has(orgId)) {
        const r = await runXeroSync(orgId, 50);
        out.sent += r.done;
        out.failed += r.failed;
      }
      out.markedPaid += await pullPayments(orgId);
      await withTenant(orgId, (tx) => pruneXeroJobs(tx, orgId));
    } catch (error) {
      console.error("Xero daily run failed for a company", error instanceof Error ? error.message : error);
    }
  }
  return out;
}
