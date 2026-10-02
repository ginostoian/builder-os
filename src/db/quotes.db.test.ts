/** Quote queries against real Postgres as the app role: numbering, autosave ops, versions and isolation. */
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { quoteTotals } from "@/core/quote";
import type { QuoteLineInput, QuoteOp, QuoteSave } from "@/core/schemas";
import { appUrl } from "@/test/db-urls";
import { createClient, setClientArchived } from "./clients";
import { closeDb, withTenant, type Tx } from "./index";
import { QuoteError, createQuote, deleteDraft, getQuote, libraryForQuotes, listQuotes, saveQuote } from "./quotes";
import { quotes } from "./schema";
import { createBundle, createService, getService } from "./services";

const clerkId = (uuid: string) => `org_${uuid.replaceAll("-", "")}`;

async function newOrg(name: string, markup = 1500): Promise<string> {
  const orgId = randomUUID();
  await withTenant(orgId, async (tx) => {
    await tx.execute(sql`insert into organizations (id, clerk_org_id, name) values (${orgId}, ${clerkId(orgId)}, ${name})`);
    await tx.execute(sql`update organizations set default_markup_bps = ${markup}, default_vat_rate_bps = 2000 where id = ${orgId}`);
  });
  return orgId;
}

const line = (name: string, qty: number, ratePence: number, extra: Partial<QuoteLineInput> = {}): QuoteLineInput => ({
  name,
  qty,
  unit: "m²",
  ratePence,
  markupBps: 1500,
  noteVisible: false,
  kind: "normal",
  ...extra,
});

/** Save ops against the quote's current version. */
async function save(tx: Tx, orgId: string, quoteId: string, ops: QuoteOp[], header?: QuoteSave["header"]) {
  const loaded = await getQuote(tx, orgId, quoteId);
  return saveQuote(tx, orgId, { quoteId, baseVersion: loaded!.quote.version, ops, header });
}

const reason = (p: Promise<unknown>) => p.then(() => "ok", (e: unknown) => (e instanceof QuoteError ? e.reason : String(e)));

beforeAll(() => {
  process.env.DATABASE_URL = appUrl();
});

afterAll(async () => {
  await closeDb();
});

describe("quotes", () => {
  it("numbers quotes per company and starts from the company defaults", async () => {
    const org = await newOrg("Numbering", 1250);
    await withTenant(org, async (tx) => {
      const client = await createClient(tx, org, { name: "Sarah" });
      const first = await createQuote(tx, org, { clientId: client, title: "Kitchen" });
      const second = await createQuote(tx, org, { clientId: client, title: "Loft" });
      const q = await getQuote(tx, org, second);
      expect(q?.quote).toMatchObject({ number: 2, title: "Loft", status: "draft", markupBps: 1250, vatRateBps: 2000, version: 0 });
      expect(q?.sections.map((s) => s.name)).toEqual(["Works"]);
      expect(q?.client?.name).toBe("Sarah");
      expect((await getQuote(tx, org, first))?.quote.number).toBe(1);
      await setClientArchived(tx, org, client, true);
      expect(await reason(createQuote(tx, org, { clientId: client, title: "No" }))).toBe("unknown_client");
    });
    // Another company starts at 1.
    const other = await newOrg("Numbering 2");
    await withTenant(other, async (tx) => {
      const client = await createClient(tx, other, { name: "Tom" });
      expect((await getQuote(tx, other, await createQuote(tx, other, { clientId: client, title: "Bath" })))?.quote.number).toBe(1);
    });
  });

  it("applies grid ops in order and keeps positions tidy", async () => {
    const org = await newOrg("Ops");
    await withTenant(org, async (tx) => {
      const client = await createClient(tx, org, { name: "C" });
      const id = await createQuote(tx, org, { clientId: client, title: "Q" });
      const works = (await getQuote(tx, org, id))!.sections[0].id;
      const [prep, a, b, c] = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
      const v1 = await save(tx, org, id, [
        { op: "addSection", sectionId: prep, name: "Prep", position: 0 },
        { op: "addLine", sectionId: works, lineId: a, position: 0, line: line("Skim", 6.2, 1_450) },
        { op: "addLine", sectionId: works, lineId: b, position: 0, line: line("Board", 1, 10_000) },
        { op: "addLine", sectionId: prep, lineId: c, position: 5, line: line("Protect floors", 1, 5_000, { kind: "provisional" }) },
      ]);
      expect(v1).toBe(1);
      let q = (await getQuote(tx, org, id))!;
      expect(q.sections.map((s) => [s.name, s.lines.map((l) => l.name)])).toEqual([["Prep", ["Protect floors"]], ["Works", ["Board", "Skim"]]]);
      expect(q.sections[1].lines[1]).toMatchObject({ qty: 6.2, ratePence: 1_450, markupBps: 1500, note: null, kind: "normal" });

      await save(tx, org, id, [
        { op: "updateLine", lineId: a, change: { field: "qty", value: 10.125 } },
        { op: "updateLine", lineId: a, change: { field: "note", value: "Two coats" } },
        { op: "updateLine", lineId: a, change: { field: "noteVisible", value: true } },
        { op: "moveLine", lineId: a, sectionId: prep, position: 0 },
        { op: "renameSection", sectionId: works, name: "Main works" },
        { op: "moveSection", sectionId: works, position: 0 },
      ]);
      q = (await getQuote(tx, org, id))!;
      expect(q.sections.map((s) => [s.name, s.lines.map((l) => l.name)])).toEqual([["Main works", ["Board"]], ["Prep", ["Skim", "Protect floors"]]]);
      expect(q.sections[1].lines[0]).toMatchObject({ qty: 10.125, note: "Two coats", noteVisible: true });

      await save(tx, org, id, [{ op: "updateLine", lineId: a, change: { field: "note", value: "" } }, { op: "removeLine", lineId: b }, { op: "removeSection", sectionId: prep }]);
      q = (await getQuote(tx, org, id))!;
      expect(q.sections.map((s) => [s.name, s.lines.length])).toEqual([["Main works", 0]]);
      expect(q.quote.version).toBe(3);
    });
  });

  it("saves the header and rejects stale versions without writing anything", async () => {
    const org = await newOrg("Versions");
    await withTenant(org, async (tx) => {
      const client = await createClient(tx, org, { name: "C" });
      const other = await createClient(tx, org, { name: "D" });
      const id = await createQuote(tx, org, { clientId: client, title: "Q" });
      const header = { clientId: other, title: "Extension", markupBps: 2000, vatRateBps: 500, validUntil: "2026-12-31", siteAddress: { line1: "1 Elm Road", town: "Bristol", postcode: "BS7 8AA" } };
      expect(await saveQuote(tx, org, { quoteId: id, baseVersion: 0, header, ops: [] })).toBe(1);
      expect((await getQuote(tx, org, id))?.quote).toMatchObject({ clientId: other, title: "Extension", markupBps: 2000, vatRateBps: 500, validUntil: "2026-12-31", siteAddress: { postcode: "BS7 8AA" } });
      const works = (await getQuote(tx, org, id))!.sections[0].id;
      // Saved against version 0 again: a second tab that hasn't seen the header save.
      expect(await reason(saveQuote(tx, org, { quoteId: id, baseVersion: 0, ops: [{ op: "addLine", sectionId: works, lineId: randomUUID(), position: 0, line: line("X", 1, 1) }] }))).toBe("conflict");
    });
    // The conflict rolled back its own transaction; check from a fresh one that nothing was added.
    await withTenant(org, async (tx) => {
      const [q] = (await listQuotes(tx, org)).quotes;
      expect((await getQuote(tx, org, q.id))?.sections[0].lines).toEqual([]);
    });
  });

  it("refuses ops that point outside the quote, and edits to sent quotes", async () => {
    const org = await newOrg("Scope");
    await withTenant(org, async (tx) => {
      const client = await createClient(tx, org, { name: "C" });
      const mine = await createQuote(tx, org, { clientId: client, title: "Mine" });
      const other = await createQuote(tx, org, { clientId: client, title: "Other" });
      const otherSection = (await getQuote(tx, org, other))!.sections[0].id;
      const otherLine = randomUUID();
      await save(tx, org, other, [{ op: "addLine", sectionId: otherSection, lineId: otherLine, position: 0, line: line("Theirs", 1, 1) }]);
      expect(await reason(save(tx, org, mine, [{ op: "addLine", sectionId: otherSection, lineId: randomUUID(), position: 0, line: line("X", 1, 1) }]))).toBe("unknown_section");
    });
    await withTenant(org, async (tx) => {
      const [, mineRow] = (await listQuotes(tx, org)).quotes;
      const other = (await listQuotes(tx, org)).quotes[0];
      const otherLine = (await getQuote(tx, org, other.id))!.sections[0].lines[0].id;
      expect(await reason(save(tx, org, mineRow.id, [{ op: "removeLine", lineId: otherLine }]))).toBe("unknown_line");
    });
    await withTenant(org, async (tx) => {
      const [, mineRow] = (await listQuotes(tx, org)).quotes;
      await tx.update(quotes).set({ status: "sent" }).where(sql`${quotes.id} = ${mineRow.id}`);
      expect(await reason(save(tx, org, mineRow.id, [{ op: "renameSection", sectionId: randomUUID(), name: "X" }]))).toBe("not_editable");
      expect(await deleteDraft(tx, org, mineRow.id)).toBe("not_draft");
    });
  });

  it("counts library usage per quote and lists totals", async () => {
    const org = await newOrg("Usage");
    await withTenant(org, async (tx) => {
      const client = await createClient(tx, org, { name: "Sarah Hale" });
      const skim = await createService(tx, org, { kind: "service", category: "Plastering", name: "Skim", unit: "m²", ratePence: 1_450 });
      await createBundle(tx, org, { category: "Plastering", name: "Room", unit: "room", items: [{ serviceId: skim, qty: 30 }] });
      const q1 = await createQuote(tx, org, { clientId: client, title: "Kitchen" });
      const q2 = await createQuote(tx, org, { clientId: client, title: "Bathroom" });
      const s1 = (await getQuote(tx, org, q1))!.sections[0].id;
      const s2 = (await getQuote(tx, org, q2))!.sections[0].id;
      const [l1, l2, l3] = [randomUUID(), randomUUID(), randomUUID()];
      await save(tx, org, q1, [
        { op: "addLine", sectionId: s1, lineId: l1, position: 0, line: line("Skim", 6.2, 1_450, { serviceId: skim }) },
        { op: "addLine", sectionId: s1, lineId: l2, position: 1, line: line("Skim again", 1, 1_450, { serviceId: skim }) },
      ]);
      await save(tx, org, q2, [{ op: "addLine", sectionId: s2, lineId: l3, position: 0, line: line("Skim", 2, 1_450, { serviceId: skim }) }]);
      expect((await getService(tx, org, skim))?.service.usageCount).toBe(2);
      await save(tx, org, q1, [{ op: "removeLine", lineId: l1 }]);
      expect((await getService(tx, org, skim))?.service.usageCount).toBe(2);
      expect(await deleteDraft(tx, org, q2)).toBe("deleted");
      expect((await getService(tx, org, skim))?.service.usageCount).toBe(1);

      const list = await listQuotes(tx, org);
      expect(list.quotes.map((q) => [q.number, q.title, q.clientName, q.total])).toEqual([
        [1, "Kitchen", "Sarah Hale", quoteTotals([{ id: "s", name: "", lines: [{ id: "l", name: "", unit: "", qty: 1, rate: 1_450, markup: 1500 }] }], 2000).total],
      ]);
      expect((await listQuotes(tx, org, { search: "q-0001" })).quotes).toHaveLength(1);
      expect((await listQuotes(tx, org, { search: "hale" })).quotes).toHaveLength(1);
      expect((await listQuotes(tx, org, { search: "loft" })).quotes).toHaveLength(0);

      const library = await libraryForQuotes(tx, org);
      expect(library.find((s) => s.kind === "bundle")?.items).toEqual([{ serviceId: skim, qty: 30, name: "Skim", unit: "m²", ratePence: 1_450, defaultMarkupBps: null }]);
    });
  });

  it("can't use another company's client, service or quote", async () => {
    const a = await newOrg("Quote A");
    const b = await newOrg("Quote B");
    const theirs = await withTenant(b, async (tx) => {
      const client = await createClient(tx, b, { name: "B client" });
      const service = await createService(tx, b, { kind: "service", category: "X", name: "B svc", unit: "m", ratePence: 1 });
      return { client, service, quote: await createQuote(tx, b, { clientId: client, title: "B quote" }) };
    });
    await withTenant(a, async (tx) => {
      expect(await reason(createQuote(tx, a, { clientId: theirs.client, title: "Steal" }))).toBe("unknown_client");
      expect(await getQuote(tx, a, theirs.quote)).toBeUndefined();
      expect(await reason(saveQuote(tx, a, { quoteId: theirs.quote, baseVersion: 0, ops: [{ op: "renameSection", sectionId: randomUUID(), name: "X" }] }))).toBe("not_found");
      expect(await deleteDraft(tx, a, theirs.quote)).toBe("not_found");
    });
    const { id, section } = await withTenant(a, async (tx) => {
      const client = await createClient(tx, a, { name: "A client" });
      const id = await createQuote(tx, a, { clientId: client, title: "A quote" });
      return { id, section: (await getQuote(tx, a, id))!.sections[0].id };
    });
    // The foreign key rejects the other company's service. Like the Server Action, let the error leave the
    // transaction: what arrives must be the friendly QuoteError, not the raw Postgres error.
    const addTheirs: QuoteOp = { op: "addLine", sectionId: section, lineId: randomUUID(), position: 0, line: line("X", 1, 1, { serviceId: theirs.service }) };
    expect(await reason(withTenant(a, (tx) => save(tx, a, id, [addTheirs])))).toBe("unknown_service");
    await withTenant(a, async (tx) => {
      const [q] = (await listQuotes(tx, a)).quotes;
      expect(await reason(save(tx, a, q.id, [], { clientId: theirs.client, title: "X", markupBps: 0, vatRateBps: 0 }))).toBe("unknown_client");
    });
  });
});
