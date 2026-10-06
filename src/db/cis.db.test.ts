/** CIS: settings, subcontractors' verified status, deductions on payments, and the monthly figures. */
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ExpenseInput } from "@/core/schemas";
import { appUrl } from "@/test/db-urls";
import { cisMonth, cisOptions, cisPayments, cisSettings, saveCisSettings, saveWorkerCis } from "./cis";
import { createClient } from "./clients";
import { CostError, createExpense, updateExpense } from "./costs";
import { closeDb, withTenant } from "./index";
import { createProject } from "./projects";
import { createWorker } from "./team";

const reason = (p: Promise<unknown>) =>
  p.then(
    () => "ok",
    (e: unknown) => (e instanceof CostError ? e.reason : String((e as { cause?: { code?: string } }).cause?.code ?? e)),
  );

async function setup() {
  const orgId = randomUUID();
  await withTenant(orgId, (tx) => tx.execute(sql`insert into organizations (id, clerk_org_id, name) values (${orgId}, ${"org_" + orgId.replaceAll("-", "")}, 'CIS Ltd')`));
  return withTenant(orgId, async (tx) => {
    const memberId = (await tx.execute<{ id: string }>(sql`insert into members (org_id, clerk_user_id, role, name) values (${orgId}, ${"user_" + orgId.slice(0, 8)}, 'admin', 'Jo') returning id`))[0].id;
    const clientId = await createClient(tx, orgId, { name: "Sarah", phone: "07700 900123" });
    const projectId = await createProject(tx, orgId, { name: "Loft", clientId, status: "on_site", shareProgress: false }, memberId);
    return { orgId, memberId, projectId };
  });
}

const bill = (projectId: string, workerId: string | null, spentOn: string, extra: Partial<ExpenseInput> = {}): ExpenseInput => ({
  projectId,
  category: "subcontractor",
  description: "Electrics first fix",
  spentOn,
  totalPence: 120_000,
  vatPence: 20_000,
  rechargeable: false,
  rechargeMarkupBps: 0,
  ...(workerId ? { cis: { workerId, materialsPence: 30_000 } } : {}),
  ...extra,
});

beforeAll(() => {
  process.env.DATABASE_URL = appUrl();
});
afterAll(async () => {
  await closeDb();
});

describe("CIS", () => {
  it("deducts by verified status, keeps the rate on edits, and totals the tax month", async () => {
    const { orgId, memberId, projectId } = await setup();
    await withTenant(orgId, async (tx) => {
      const sparks = await createWorker(tx, orgId, { name: "Sparks Ltd", kind: "subcontractor" });
      const newbie = await createWorker(tx, orgId, { name: "New Guy", kind: "subcontractor" });
      const employee = await createWorker(tx, orgId, { name: "Pat", kind: "employee" });

      // Off: the CIS part is ignored.
      expect(await cisOptions(tx, orgId)).toBeNull();
      const before = await createExpense(tx, orgId, bill(projectId, sparks, "2026-09-10"), memberId);
      expect((await tx.execute(sql`select cis_rate_bps from expenses where id = ${before}`))[0].cis_rate_bps).toBeNull();

      await saveCisSettings(tx, orgId, { enabled: true, contractorUtr: null, employerRef: "123/AB45678", accountsOfficeRef: null });
      expect((await cisSettings(tx, orgId)).enabled).toBe(true);
      // Employees can't have CIS details; subcontractors can.
      expect(await saveWorkerCis(tx, orgId, employee, { status: "standard", utr: "1234567890", verificationRef: null, verifiedOn: null })).toBe(false);
      expect(await saveWorkerCis(tx, orgId, sparks, { status: "standard", utr: "1234567890", verificationRef: "V1234567890", verifiedOn: "2026-09-01" })).toBe(true);
      expect((await cisOptions(tx, orgId))!.map((o) => [o.name, o.rateBps])).toEqual([
        ["New Guy", 3000],
        ["Sparks Ltd", 2000],
      ]);

      // £1,000 before VAT, £300 materials: 20% of £700 = £140; unverified: 30% = £210.
      const a = await createExpense(tx, orgId, bill(projectId, sparks, "2026-09-12"), memberId);
      const b = await createExpense(tx, orgId, bill(projectId, newbie, "2026-10-05"), memberId);
      // Next tax month (from 6 October).
      await createExpense(tx, orgId, bill(projectId, sparks, "2026-10-06"), memberId);
      expect(await reason(createExpense(tx, orgId, bill(projectId, employee, "2026-09-12"), memberId))).toBe("unknown_subcontractor");

      // Their status changes later: the payment already made keeps its rate.
      await saveWorkerCis(tx, orgId, sparks, { status: "gross", utr: "1234567890", verificationRef: null, verifiedOn: null });
      await updateExpense(tx, orgId, a, bill(projectId, sparks, "2026-09-12", { description: "First fix (edited)" }));

      const month = await cisMonth(tx, orgId, "2026-09-06", "2026-10-05");
      expect(month.map((l) => [l.name, l.grossPence, l.materialsPence, l.deductionPence, l.payments])).toEqual([
        ["New Guy", 100_000, 30_000, 21_000, 1],
        ["Sparks Ltd", 100_000, 30_000, 14_000, 1],
      ]);
      expect((await cisPayments(tx, orgId, newbie, "2026-09-06", "2026-10-05")).map((p) => p.id)).toEqual([b]);
      return sparks;
    }).then(async (sparks) => {
      // Materials can't be more than the payment before VAT (the database refuses it too).
      expect(await reason(withTenant(orgId, (tx) => createExpense(tx, orgId, bill(projectId, sparks, "2026-09-12", { cis: { workerId: sparks, materialsPence: 200_000 } }), memberId)))).toBe("23514");
    });
  });
});
