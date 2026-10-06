/**
 * The Construction Industry Scheme: the company's CIS settings, each subcontractor's verified status, and
 * the monthly figures (gross paid, materials, deductions) for the CIS300 return and the statements given
 * to subcontractors. The deduction on each payment is worked out when it's recorded (see costs.ts), so a
 * later change to someone's status never rewrites the past.
 */
import "server-only";
import { and, asc, eq, gte, isNotNull, lte, sql } from "drizzle-orm";
import { CIS_RATE_BPS, type CisLine, type CisStatus } from "@/core/cis";
import type { Tx } from "./index";
import { expenses, organizations, projects, workers } from "./schema";

export type CisSettings = { enabled: boolean; contractorUtr: string | null; employerRef: string | null; accountsOfficeRef: string | null };

export async function cisSettings(tx: Tx, orgId: string): Promise<CisSettings> {
  const [o] = await tx
    .select({ enabled: organizations.cisEnabled, contractorUtr: organizations.cisContractorUtr, employerRef: organizations.cisEmployerRef, accountsOfficeRef: organizations.cisAccountsOfficeRef })
    .from(organizations)
    .where(eq(organizations.id, orgId));
  return o ?? { enabled: false, contractorUtr: null, employerRef: null, accountsOfficeRef: null };
}

export async function saveCisSettings(tx: Tx, orgId: string, s: CisSettings) {
  await tx
    .update(organizations)
    .set({ cisEnabled: s.enabled, cisContractorUtr: s.contractorUtr, cisEmployerRef: s.employerRef, cisAccountsOfficeRef: s.accountsOfficeRef, updatedAt: new Date() })
    .where(eq(organizations.id, orgId));
}

export type WorkerCis = { status: CisStatus | null; utr: string | null; verificationRef: string | null; verifiedOn: string | null };

export async function saveWorkerCis(tx: Tx, orgId: string, workerId: string, c: WorkerCis): Promise<boolean> {
  const rows = await tx
    .update(workers)
    .set({ cisStatus: c.status, utr: c.utr, cisVerificationRef: c.verificationRef, cisVerifiedOn: c.verifiedOn })
    .where(and(eq(workers.orgId, orgId), eq(workers.id, workerId), eq(workers.kind, "subcontractor")))
    .returning({ id: workers.id });
  return rows.length > 0;
}

/** Subcontractors who can be paid under CIS, with the rate their status gives (unverified: the higher rate). */
export async function cisSubcontractors(tx: Tx, orgId: string) {
  const rows = await tx
    .select({ id: workers.id, name: workers.name, status: workers.cisStatus, utr: workers.utr })
    .from(workers)
    .where(and(eq(workers.orgId, orgId), eq(workers.kind, "subcontractor"), sql`${workers.archivedAt} is null`))
    .orderBy(asc(sql`lower(${workers.name})`));
  return rows.map((r) => ({ ...r, rateBps: CIS_RATE_BPS[r.status ?? "higher"] }));
}

/** The rate to deduct for a subcontractor right now, or null if they aren't one. */
export async function cisRateFor(tx: Tx, orgId: string, workerId: string): Promise<number | null> {
  const [w] = await tx
    .select({ status: workers.cisStatus, kind: workers.kind })
    .from(workers)
    .where(and(eq(workers.orgId, orgId), eq(workers.id, workerId)));
  if (!w || w.kind !== "subcontractor") return null;
  return CIS_RATE_BPS[w.status ?? "higher"];
}

/** One tax month's CIS payments, totalled per subcontractor (for the CIS300 return). */
export async function cisMonth(tx: Tx, orgId: string, start: string, end: string): Promise<CisLine[]> {
  const rows = await tx
    .select({
      workerId: workers.id,
      name: workers.name,
      utr: workers.utr,
      status: workers.cisStatus,
      verificationRef: workers.cisVerificationRef,
      grossPence: sql<number>`sum(${expenses.netPence})::int`,
      materialsPence: sql<number>`sum(${expenses.cisMaterialsPence})::int`,
      deductionPence: sql<number>`sum(${expenses.cisDeductionPence})::int`,
      payments: sql<number>`count(*)::int`,
    })
    .from(expenses)
    .innerJoin(workers, and(eq(workers.orgId, expenses.orgId), eq(workers.id, expenses.workerId)))
    .where(and(eq(expenses.orgId, orgId), isNotNull(expenses.cisRateBps), gte(expenses.spentOn, start), lte(expenses.spentOn, end)))
    .groupBy(workers.id)
    .orderBy(asc(sql`lower(${workers.name})`));
  return rows;
}

/** Each CIS payment to one subcontractor in a tax month, for their payment and deduction statement. */
export async function cisPayments(tx: Tx, orgId: string, workerId: string, start: string, end: string) {
  return tx
    .select({
      id: expenses.id,
      spentOn: expenses.spentOn,
      description: expenses.description,
      projectName: projects.name,
      netPence: expenses.netPence,
      vatPence: expenses.vatPence,
      materialsPence: expenses.cisMaterialsPence,
      rateBps: expenses.cisRateBps,
      deductionPence: expenses.cisDeductionPence,
    })
    .from(expenses)
    .innerJoin(projects, and(eq(projects.orgId, expenses.orgId), eq(projects.id, expenses.projectId)))
    .where(and(eq(expenses.orgId, orgId), eq(expenses.workerId, workerId), isNotNull(expenses.cisRateBps), gte(expenses.spentOn, start), lte(expenses.spentOn, end)))
    .orderBy(asc(expenses.spentOn));
}

/** For the expense form: the subcontractors to pay under CIS, or null when the company doesn't use CIS. */
export async function cisOptions(tx: Tx, orgId: string) {
  if (!(await cisSettings(tx, orgId)).enabled) return null;
  return (await cisSubcontractors(tx, orgId)).map((s) => ({ id: s.id, name: s.name, rateBps: s.rateBps }));
}
