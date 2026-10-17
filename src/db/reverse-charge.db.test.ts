/** The VAT domestic reverse charge from client to invoice, against real Postgres as the app role. */
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { QuoteLineInput } from "@/core/schemas";
import { appUrl } from "@/test/db-urls";
import { createClient } from "./clients";
import { closeDb, withTenant, type Tx } from "./index";
import { createInvoice, savePaymentSettings, type InvoiceSnapshot } from "./invoices";
import { decide } from "./portal";
import { QuoteError, createQuote, getQuote, saveQuote } from "./quotes";
import { sendQuote } from "./sending";
import { billableVariations, createVariation, decideVariation, getVariation, saveVariation, sendVariation } from "./variations";
import { invoices, organizations, quotes, variations } from "./schema";
import { eq } from "drizzle-orm";

const clerkId = (uuid: string) => `org_${uuid.replaceAll("-", "")}`;
const line = (name: string, qty: number, ratePence: number): QuoteLineInput => ({ name, qty, unit: "day", ratePence, markupBps: 0, noteVisible: false, kind: "normal" });
const reason = (p: Promise<unknown>) =>
  p.then(
    () => "ok",
    (e: unknown) => (e instanceof QuoteError ? e.reason : String((e as { cause?: { code?: string } }).cause?.code ?? e)),
  );
const version = async (tx: Tx, orgId: string, quoteId: string) => (await getQuote(tx, orgId, quoteId))!.quote.version;

async function newOrg() {
  const orgId = randomUUID();
  await withTenant(orgId, (tx) => tx.execute(sql`insert into organizations (id, clerk_org_id, name) values (${orgId}, ${clerkId(orgId)}, 'Sparks Electrical')`));
  const memberId = await withTenant(orgId, async (tx) => {
    const rows = await tx.execute<{ id: string }>(
      sql`insert into members (org_id, clerk_user_id, role, name) values (${orgId}, ${"user_" + orgId.slice(0, 8)}, 'admin', 'Jo') returning id`,
    );
    await savePaymentSettings(tx, orgId, { bankAccountName: "Sparks Ltd", bankSortCode: "123456", bankAccountNumber: "12345678", paymentTermsDays: 30, remindersEnabled: false });
    return rows[0].id;
  });
  return { orgId, memberId };
}

beforeAll(() => {
  process.env.DATABASE_URL = appUrl();
});
afterAll(async () => {
  await closeDb();
});

describe("VAT domestic reverse charge", () => {
  it("runs from a reverse charge client to an invoice that shows the VAT without charging it", async () => {
    const { orgId, memberId } = await newOrg();
    await withTenant(orgId, async (tx) => {
      const clientId = await createClient(tx, orgId, { name: "Main Contractor Ltd", email: "accounts@main.example", vatTreatment: "reverse_charge" });
      const quoteId = await createQuote(tx, orgId, { clientId, title: "Second fix electrics" });
      const q = (await getQuote(tx, orgId, quoteId))!;
      expect(q.quote).toMatchObject({ vatTreatment: "reverse_charge", vatRateBps: 2000 });
      await saveQuote(tx, orgId, {
        quoteId,
        baseVersion: 0,
        ops: [{ op: "addLine", sectionId: q.sections[0].id, lineId: randomUUID(), position: 0, line: line("Electrician", 10, 25_000) }],
        paymentPlan: [
          { id: randomUUID(), label: "Deposit", amountKind: "percent", amountValue: 3000, dueKind: "on_acceptance" },
          { id: randomUUID(), label: "Completion", amountKind: "balance", dueKind: "milestone" },
        ],
      });

      // A reverse charge invoice must show the supplier's VAT number, so sending waits for one.
      expect(await reason(sendQuote(tx, orgId, { quoteId, baseVersion: await version(tx, orgId, quoteId), memberId }))).toBe("no_vat_number");
    });
    await withTenant(orgId, (tx) => tx.update(organizations).set({ vatNumber: "GB123456789" }).where(eq(organizations.id, orgId)));

    await withTenant(orgId, async (tx) => {
      const [{ id: quoteId, number }] = await tx.select({ id: quotes.id, number: quotes.number }).from(quotes).where(eq(quotes.orgId, orgId));
      const sent = await sendQuote(tx, orgId, { quoteId, baseVersion: await version(tx, orgId, quoteId), memberId });
      expect(sent.snapshot.quote.vatTreatment).toBe("reverse_charge");
      expect(sent.snapshot.totals).toEqual({ net: 250_000, vat: 0, total: 250_000, reverseChargeVat: 50_000 });
      const clientId = (await getQuote(tx, orgId, quoteId))!.quote.clientId;
      await decide(tx, orgId, clientId, number, { decision: "accepted", fullName: "Pat Main", signature: "Pat Main", agree: true }, { ip: null, userAgent: null });

      // A variation follows the quote: no VAT charged, the reverse charge VAT shown.
      const variationId = await createVariation(tx, orgId, { quoteId, memberId });
      expect((await getVariation(tx, orgId, variationId))!.variation.vatTreatment).toBe("reverse_charge");
      await saveVariation(tx, orgId, {
        variationId,
        title: "Extra circuit",
        lines: [{ id: randomUUID(), name: "Circuit", qty: 1, unit: "item", ratePence: 40_000, markupBps: 0, omit: false }],
      });
      const v = await sendVariation(tx, orgId, { variationId, memberId });
      expect(v.snapshot.totals).toEqual({ net: 40_000, vat: 0, total: 40_000, reverseChargeVat: 8_000 });
      await decideVariation(
        tx,
        orgId,
        clientId,
        { quoteNumber: number, number: 1 },
        { decision: "accepted", fullName: "Pat Main", signature: "Pat Main", agree: true },
        { ip: null, userAgent: null },
      );
      expect((await billableVariations(tx, orgId, quoteId)).map((b) => b.vatPence)).toEqual([0]);
      // What the client approved is frozen, VAT treatment included.
      expect(await reason(tx.transaction((t) => t.update(variations).set({ vatTreatment: "standard" }).where(eq(variations.id, variationId))))).toBe("42501");

      const deposit = sent.snapshot.paymentPlan![0];
      expect(deposit.amount).toBe(75_000);
      const inv = await createInvoice(tx, orgId, { quoteId, stageId: deposit.id, variationIds: [variationId], memberId }, "2026-10-17");
      const [row] = await tx.select().from(invoices).where(eq(invoices.id, inv.id));
      expect(row).toMatchObject({ netPence: 115_000, vatPence: 0, totalPence: 115_000, reverseChargeVatPence: 23_000 });
      const snap = row.snapshot as InvoiceSnapshot;
      expect(snap).toMatchObject({ vatTreatment: "reverse_charge", reverseChargeVat: 23_000, vatRateBps: 2000 });
      expect(snap.lines).toEqual([
        { description: "Deposit", net: 75_000, vat: 0, total: 75_000, reverseChargeVat: 15_000 },
        { description: "Variation V1: Extra circuit", net: 40_000, vat: 0, total: 40_000, reverseChargeVat: 8_000 },
      ]);
    });
  });

  it("keeps standard quotes exactly as before, and the database refuses a reverse charge with no rate", async () => {
    const { orgId } = await newOrg();
    await withTenant(orgId, async (tx) => {
      const clientId = await createClient(tx, orgId, { name: "Sarah Hale" });
      const quoteId = await createQuote(tx, orgId, { clientId, title: "Kitchen" });
      expect((await getQuote(tx, orgId, quoteId))!.quote.vatTreatment).toBe("standard");
      expect(await reason(tx.transaction((t) => t.update(quotes).set({ vatTreatment: "reverse_charge", vatRateBps: 0 }).where(eq(quotes.id, quoteId))))).toBe("23514");
    });
  });
});
