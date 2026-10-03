/** Variations: drafting, sending, the client's decision, records staying fixed, and invoicing them. */
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { canonicalJson } from "@/core/quote-snapshot";
import type { QuoteLineInput } from "@/core/schemas";
import type { VariationLine } from "@/core/variation";
import { appUrl } from "@/test/db-urls";
import { createClient } from "./clients";
import { closeDb, withTenant, type Tx } from "./index";
import { InvoiceError, createInvoice, getInvoice, savePaymentSettings, voidInvoice } from "./invoices";
import { decide } from "./portal";
import { createQuote, getQuote, saveQuote } from "./quotes";
import { sendQuote, sha256 } from "./sending";
import {
  VariationError,
  billableVariations,
  createVariation,
  decideVariation,
  deleteVariation,
  getVariation,
  portalVariation,
  portalVariations,
  quoteVariations,
  reviseVariation,
  saveVariation,
  sendVariation,
  withdrawVariation,
} from "./variations";

const TODAY = "2026-10-03";
const clerkId = (uuid: string) => `org_${uuid.replaceAll("-", "")}`;
const qline = (name: string, qty: number, ratePence: number): QuoteLineInput => ({ name, qty, unit: "m²", ratePence, markupBps: 1500, noteVisible: false, kind: "normal" });
const vline = (over: Partial<VariationLine> = {}): VariationLine => ({ id: randomUUID(), name: "Extra double socket", qty: 2, unit: "item", ratePence: 6_000, markupBps: 2000, omit: false, ...over });
const reason = (p: Promise<unknown>) =>
  p.then(
    () => "ok",
    (e: unknown) => (e instanceof VariationError || e instanceof InvoiceError ? e.reason : String((e as { cause?: { code?: string } }).cause?.code ?? (e as { code?: string }).code ?? e)),
  );
const approve = { decision: "accepted" as const, fullName: "Sarah Hale", signature: "Sarah Hale", agree: true as const };
const noEvidence = { ip: null, userAgent: null };

async function newOrg(name: string) {
  const orgId = randomUUID();
  await withTenant(orgId, (tx) => tx.execute(sql`insert into organizations (id, clerk_org_id, name) values (${orgId}, ${clerkId(orgId)}, ${name})`));
  const memberId = await withTenant(orgId, async (tx) => {
    const rows = await tx.execute<{ id: string }>(sql`insert into members (org_id, clerk_user_id, role, name) values (${orgId}, ${"user_" + orgId.slice(0, 8)}, 'admin', 'Jo') returning id`);
    await savePaymentSettings(tx, orgId, { bankAccountName: "Hale Ltd", bankSortCode: "123456", bankAccountNumber: "12345678", paymentTermsDays: 14, remindersEnabled: true });
    return rows[0].id;
  });
  return { orgId, memberId };
}

/** An accepted quote with a deposit and balance plan. */
async function acceptedQuote(orgId: string, memberId: string, accept = true) {
  return withTenant(orgId, async (tx) => {
    const clientId = await createClient(tx, orgId, { name: "Sarah Hale", email: "sarah@example.com" });
    const quoteId = await createQuote(tx, orgId, { clientId, title: "Kitchen" });
    const q = (await getQuote(tx, orgId, quoteId))!;
    await saveQuote(tx, orgId, {
      quoteId,
      baseVersion: 0,
      ops: [{ op: "addLine", sectionId: q.sections[0].id, lineId: randomUUID(), position: 0, line: qline("Skim", 100, 2_000) }],
      paymentPlan: [
        { id: randomUUID(), label: "Deposit", amountKind: "percent", amountValue: 2500, dueKind: "on_acceptance" },
        { id: randomUUID(), label: "Balance", amountKind: "balance", dueKind: "milestone" },
      ],
    });
    const sent = await sendQuote(tx, orgId, { quoteId, baseVersion: (await getQuote(tx, orgId, quoteId))!.quote.version, memberId });
    if (accept) await decide(tx, orgId, clientId, q.quote.number, approve, noEvidence);
    return { clientId, quoteId, quoteNumber: q.quote.number, stages: sent.snapshot.paymentPlan! };
  });
}

/** Draft → saved → sent, returning the variation id. */
async function sentVariation(orgId: string, memberId: string, quoteId: string, lines: VariationLine[] = [vline()]) {
  return withTenant(orgId, async (tx) => {
    const id = await createVariation(tx, orgId, { quoteId, memberId });
    await saveVariation(tx, orgId, { variationId: id, title: "Extra sockets", reason: "Requested on site", lines });
    await sendVariation(tx, orgId, { variationId: id, memberId });
    return id;
  });
}

const status = async (tx: Tx, orgId: string, id: string) => (await getVariation(tx, orgId, id))!.variation.status;

beforeAll(() => {
  process.env.DATABASE_URL = appUrl();
});
afterAll(async () => {
  await closeDb();
});

describe("drafting and sending", () => {
  it("only exists on accepted quotes, is numbered per quote and priced on the server", async () => {
    const { orgId, memberId } = await newOrg("Var draft");
    const pending = await acceptedQuote(orgId, memberId, false);
    expect(await reason(withTenant(orgId, (tx) => createVariation(tx, orgId, { quoteId: pending.quoteId, memberId })))).toBe("not_accepted");

    const { quoteId } = await acceptedQuote(orgId, memberId);
    await withTenant(orgId, async (tx) => {
      const a = await createVariation(tx, orgId, { quoteId, memberId });
      const b = await createVariation(tx, orgId, { quoteId, memberId });
      expect((await quoteVariations(tx, orgId, quoteId)).map((v) => [v.number, v.title, v.status])).toEqual([
        [1, "Variation 1", "draft"],
        [2, "Variation 2", "draft"],
      ]);
      await saveVariation(tx, orgId, { variationId: a, title: "Sockets", lines: [vline(), vline({ name: "Leave out skirting", qty: 10, unit: "m", ratePence: 800, markupBps: 1500, omit: true })] });
      // 2 × £72 − 10 × £9.20 = £52 net + 20% VAT.
      expect((await getVariation(tx, orgId, a))!.variation).toMatchObject({ netPence: 5_200, vatPence: 1_040, totalPence: 6_240 });
      expect(await reason(sendVariation(tx, orgId, { variationId: b, memberId }))).toBe("empty");
      expect(await deleteVariation(tx, orgId, b)).toBe(quoteId);
    });
  });

  it("freezes a client-safe snapshot when sent, and the database keeps it fixed", async () => {
    const { orgId, memberId } = await newOrg("Var send");
    const { quoteId } = await acceptedQuote(orgId, memberId);
    const id = await sentVariation(orgId, memberId, quoteId);
    await withTenant(orgId, async (tx) => {
      const v = (await getVariation(tx, orgId, id))!.variation;
      expect(v.status).toBe("sent");
      expect(v.contentHash).toBe(sha256(canonicalJson(v.snapshot)));
      expect(JSON.stringify(v.snapshot)).not.toMatch(/ratePence|markup/i);
      expect(v.snapshot!.ref).toMatch(/^Q-\d{4}-V1$/);
      expect(await reason(saveVariation(tx, orgId, { variationId: id, title: "Changed", lines: [vline()] }))).toBe("not_editable");
      expect(await reason(deleteVariation(tx, orgId, id))).toBe("not_editable");
    });
    const raw = postgres(appUrl(), { max: 1, onnotice: () => {} });
    try {
      for (const stmt of [
        "update variations set total_pence = 1, net_pence = 1, vat_pence = 0",
        "update variations set lines = '[]'",
        "update variations set title = 'x'",
        "update variations set status = 'draft'",
        "delete from variations",
      ]) {
        await raw
          .begin(async (t) => {
            await t`select set_config('app.org_id', ${orgId}, true)`;
            await t.unsafe(stmt);
          })
          .then(
            () => expect.unreachable(stmt),
            (e: { code?: string }) => expect(e.code, stmt).toBe("42501"),
          );
      }
    } finally {
      await raw.end();
    }
  });
});

describe("the client's decision", () => {
  it("shows sent variations in the portal, takes one signed decision, and keeps it final", async () => {
    const { orgId, memberId } = await newOrg("Var decide");
    const { clientId, quoteId, quoteNumber } = await acceptedQuote(orgId, memberId);
    const draft = await withTenant(orgId, (tx) => createVariation(tx, orgId, { quoteId, memberId }));
    const id = await sentVariation(orgId, memberId, quoteId);
    const rejectMe = await sentVariation(orgId, memberId, quoteId);

    await withTenant(orgId, async (tx) => {
      // The draft (number 1) is invisible; the sent ones are 2 and 3.
      expect((await portalVariations(tx, orgId, clientId)).map((v) => v.number).sort()).toEqual([2, 3]);
      expect(await portalVariation(tx, orgId, clientId, quoteNumber, 1)).toBeUndefined();
      const r = await decideVariation(tx, orgId, clientId, { quoteNumber, number: 2 }, approve, { ip: "203.0.113.9", userAgent: "Test" });
      expect(r.variationId).toBe(id);
      expect(await reason(decideVariation(tx, orgId, clientId, { quoteNumber, number: 2 }, { decision: "declined", fullName: "S" }, noEvidence))).toBe("decided");
      await decideVariation(tx, orgId, clientId, { quoteNumber, number: 3 }, { decision: "declined", fullName: "Sarah Hale", reason: "Too dear" }, noEvidence);
      expect((await getVariation(tx, orgId, id))!.variation).toMatchObject({ status: "approved", signature: "Sarah Hale", decisionIp: "203.0.113.9" });
      expect((await getVariation(tx, orgId, rejectMe))!.variation).toMatchObject({ status: "rejected", decisionReason: "Too dear", signature: null });
      expect(await status(tx, orgId, draft)).toBe("draft");
    });

    const raw = postgres(appUrl(), { max: 1, onnotice: () => {} });
    try {
      for (const stmt of [`update variations set status = 'rejected' where id = '${id}'`, `update variations set signature = 'forged' where id = '${id}'`, `update variations set status = 'approved', signature = 'x', decision_name = 'x' where id = '${rejectMe}'`]) {
        await raw
          .begin(async (t) => {
            await t`select set_config('app.org_id', ${orgId}, true)`;
            await t.unsafe(stmt);
          })
          .then(
            () => expect.unreachable(stmt),
            (e: { code?: string }) => expect(e.code, stmt).toBe("42501"),
          );
      }
    } finally {
      await raw.end();
    }
  });

  it("can be withdrawn or revised into a new draft before the client decides", async () => {
    const { orgId, memberId } = await newOrg("Var revise");
    const { clientId, quoteId, quoteNumber } = await acceptedQuote(orgId, memberId);
    const id = await sentVariation(orgId, memberId, quoteId, [vline({ qty: 3 })]);
    const next = await withTenant(orgId, (tx) => reviseVariation(tx, orgId, id, memberId));
    await withTenant(orgId, async (tx) => {
      expect(await status(tx, orgId, id)).toBe("withdrawn");
      const copy = (await getVariation(tx, orgId, next))!.variation;
      expect(copy).toMatchObject({ number: 2, status: "draft", title: "Extra sockets" });
      expect(copy.lines[0].qty).toBe(3);
      // Withdrawn ones disappear from the portal and can't be decided.
      expect(await portalVariations(tx, orgId, clientId)).toEqual([]);
      expect(await reason(decideVariation(tx, orgId, clientId, { quoteNumber, number: 1 }, approve, noEvidence))).toBe("not_found");
      expect(await reason(withdrawVariation(tx, orgId, id))).toBe("not_open");
    });
  });
});

describe("invoicing variations", () => {
  it("bills approved variations alone or with a payment, once, with credits taken off", async () => {
    const { orgId, memberId } = await newOrg("Var invoice");
    const { clientId, quoteId, quoteNumber, stages } = await acceptedQuote(orgId, memberId);
    const extra = await sentVariation(orgId, memberId, quoteId);
    const credit = await sentVariation(orgId, memberId, quoteId, [vline({ name: "Leave out tiling", qty: 1, ratePence: 5_000, markupBps: 0, omit: true })]);
    const unapproved = await sentVariation(orgId, memberId, quoteId);
    await withTenant(orgId, async (tx) => {
      await decideVariation(tx, orgId, clientId, { quoteNumber, number: 1 }, approve, noEvidence);
      await decideVariation(tx, orgId, clientId, { quoteNumber, number: 2 }, approve, noEvidence);
    });
    const create = (stageId: string | undefined, variationIds: string[]) => withTenant(orgId, (tx) => createInvoice(tx, orgId, { quoteId, stageId, variationIds, memberId }, TODAY));

    expect(await reason(create(undefined, [unapproved]))).toBe("unknown_variation");
    expect(await reason(create(undefined, [credit]))).toBe("credit_too_big");

    // Variation on its own: 2 × £72 + VAT.
    const alone = await create(undefined, [extra]);
    expect(alone).toMatchObject({ totalPence: 17_280, dueDate: "2026-10-17" });
    expect(alone.snapshot.lines).toEqual([{ description: "Variation V1: Extra sockets", net: 14_400, vat: 2_880, total: 17_280 }]);
    expect(await reason(create(undefined, [extra]))).toBe("unknown_variation");

    // The deposit with the omission credited.
    const deposit = await create(stages[0].id, [credit]);
    expect(deposit.totalPence).toBe(stages[0].amount - 6_000);
    expect(deposit.snapshot.lines!.map((l) => l.total)).toEqual([stages[0].amount, -6_000]);
    expect(deposit.snapshot.description).toMatch(/^Deposit and 1 variation:/);
    await withTenant(orgId, async (tx) => {
      expect(await billableVariations(tx, orgId, quoteId)).toEqual([]);
      const inv = (await getInvoice(tx, orgId, deposit.id))!;
      expect(inv.netPence + inv.vatPence).toBe(inv.totalPence);
      // Voiding the invoice frees its variations to be billed again.
      await voidInvoice(tx, orgId, alone.id);
      expect((await billableVariations(tx, orgId, quoteId)).map((v) => v.id)).toEqual([extra]);
      expect((await getVariation(tx, orgId, extra))!.billed).toBe(false);
    });
  });
});

describe("isolation", () => {
  it("never shows a client another client's variations, or another company's", async () => {
    const a = await newOrg("Var iso A");
    const b = await newOrg("Var iso B");
    const q1 = await acceptedQuote(a.orgId, a.memberId);
    const q2 = await acceptedQuote(a.orgId, a.memberId);
    const id = await sentVariation(a.orgId, a.memberId, q1.quoteId);
    await withTenant(a.orgId, async (tx) => {
      expect(await portalVariations(tx, a.orgId, q2.clientId)).toEqual([]);
      expect(await portalVariation(tx, a.orgId, q2.clientId, q1.quoteNumber, 1)).toBeUndefined();
      expect(await reason(decideVariation(tx, a.orgId, q2.clientId, { quoteNumber: q1.quoteNumber, number: 1 }, approve, noEvidence))).toBe("not_found");
    });
    await withTenant(b.orgId, async (tx) => {
      expect(await getVariation(tx, b.orgId, id)).toBeUndefined();
      expect(await reason(createVariation(tx, b.orgId, { quoteId: q1.quoteId, memberId: b.memberId }))).toBe("not_accepted");
      expect(await reason(withdrawVariation(tx, b.orgId, id))).toBe("not_open");
    });
  });
});
