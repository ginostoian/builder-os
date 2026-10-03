/** Dashboard figures, duplicate quote and alert recipients, against real Postgres as the app role. */
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { QuoteLineInput } from "@/core/schemas";
import { appUrl } from "@/test/db-urls";
import { createClient } from "./clients";
import { dashboardData, startOfUkMonth } from "./dashboard";
import { closeDb, findPortalAccess, withTenant, type Tx } from "./index";
import { decide, recordView } from "./portal";
import { createQuote, duplicateQuote, getQuote, saveQuote } from "./quotes";
import { alertContext, sendQuote } from "./sending";
import { createService, getService } from "./services";

const line = (name: string, qty: number, ratePence: number, extra: Partial<QuoteLineInput> = {}): QuoteLineInput => ({ name, qty, unit: "m²", ratePence, markupBps: 0, noteVisible: false, kind: "normal", ...extra });
const version = async (tx: Tx, orgId: string, quoteId: string) => (await getQuote(tx, orgId, quoteId))!.quote.version;

async function newOrg() {
  const orgId = randomUUID();
  await withTenant(orgId, (tx) => tx.execute(sql`insert into organizations (id, clerk_org_id, name) values (${orgId}, ${"org_" + orgId.replaceAll("-", "")}, 'Dash Co')`));
  const ids = await withTenant(orgId, async (tx) => {
    const admin = (await tx.execute<{ id: string }>(sql`insert into members (org_id, clerk_user_id, role, name, email) values (${orgId}, ${"u_admin_" + orgId.slice(0, 6)}, 'admin', 'Ada', 'ada@example.com') returning id`))[0].id;
    const sender = (await tx.execute<{ id: string }>(sql`insert into members (org_id, clerk_user_id, role, name, email) values (${orgId}, ${"u_est_" + orgId.slice(0, 6)}, 'estimator', 'Esme', 'esme@example.com') returning id`))[0].id;
    const quiet = (await tx.execute<{ id: string }>(sql`insert into members (org_id, clerk_user_id, role, name) values (${orgId}, ${"u_q_" + orgId.slice(0, 6)}, 'estimator', 'No Email') returning id`))[0].id;
    return { admin, sender, quiet };
  });
  return { orgId, ...ids };
}

async function sentQuote(orgId: string, memberId: string, title: string, ratePence: number) {
  return withTenant(orgId, async (tx) => {
    const clientId = await createClient(tx, orgId, { name: `${title} client` });
    const quoteId = await createQuote(tx, orgId, { clientId, title });
    const q = (await getQuote(tx, orgId, quoteId))!;
    await saveQuote(tx, orgId, { quoteId, baseVersion: 0, ops: [{ op: "addLine", sectionId: q.sections[0].id, lineId: randomUUID(), position: 0, line: line("Work", 1, ratePence) }] });
    const sent = await sendQuote(tx, orgId, { quoteId, baseVersion: await version(tx, orgId, quoteId), memberId });
    return { quoteId, clientId, number: q.quote.number, token: sent.token };
  });
}

beforeAll(() => {
  process.env.DATABASE_URL = appUrl();
});
afterAll(async () => {
  await closeDb();
});

describe("dashboard", () => {
  it("adds up what's awaiting a reply, what was won this month, opens and win rate", async () => {
    const o = await newOrg();
    const a = await sentQuote(o.orgId, o.sender, "Kitchen", 100_000);
    const b = await sentQuote(o.orgId, o.sender, "Bathroom", 50_000);
    const c = await sentQuote(o.orgId, o.sender, "Loft", 20_000);
    const access = (await findPortalAccess(a.token))!;
    await withTenant(o.orgId, (tx) => recordView(tx, o.orgId, access, a.number));
    await withTenant(o.orgId, (tx) => decide(tx, o.orgId, b.clientId, b.number, { decision: "accepted", fullName: "B", signature: "B", agree: true }, { ip: null, userAgent: null }));
    await withTenant(o.orgId, (tx) => decide(tx, o.orgId, c.clientId, c.number, { decision: "declined", fullName: "C" }, { ip: null, userAgent: null }));
    const d = await withTenant(o.orgId, (tx) => dashboardData(tx, o.orgId));
    expect(d.awaiting.map((q) => [q.title, q.views])).toEqual([["Kitchen", 1]]);
    expect(d.awaitingValue).toBe(120_000); // £1,000 + 20% VAT
    expect(d.wonThisMonth).toEqual({ count: 1, value: 60_000 });
    expect(d.winRate90).toBe(50);
    expect(d.openedThisWeek).toBe(1);
    expect(d.activity.map((e) => e.kind)).toEqual(["declined", "accepted", "viewed"]);
  });

  it("finds midnight on the 1st in UK time, in winter and summer", () => {
    expect(startOfUkMonth(new Date("2026-01-15T12:00:00Z")).toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(startOfUkMonth(new Date("2026-07-15T12:00:00Z")).toISOString()).toBe("2026-06-30T23:00:00.000Z");
  });
});

describe("duplicate quote", () => {
  it("copies sections, lines and settings into a new numbered draft, and counts library usage", async () => {
    const o = await newOrg();
    const { quoteId, svc } = await withTenant(o.orgId, async (tx) => {
      const svc = await createService(tx, o.orgId, { kind: "service", category: "P", name: "Skim", unit: "m²", ratePence: 1_450 });
      const clientId = await createClient(tx, o.orgId, { name: "Dup" });
      const quoteId = await createQuote(tx, o.orgId, { clientId, title: "Original" });
      const q = (await getQuote(tx, o.orgId, quoteId))!;
      const extra = randomUUID();
      await saveQuote(tx, o.orgId, {
        quoteId,
        baseVersion: 0,
        header: { clientId, title: "Original", markupBps: 1750, vatRateBps: 500, siteAddress: { line1: "1 A St", town: "Bath", postcode: "BA1 1AA" } },
        ops: [
          { op: "addLine", sectionId: q.sections[0].id, lineId: randomUUID(), position: 0, line: line("Skim", 6.2, 1_450, { serviceId: svc, note: "n", noteVisible: true }) },
          { op: "addSection", sectionId: extra, name: "Extras", position: 1 },
          { op: "addLine", sectionId: extra, lineId: randomUUID(), position: 0, line: line("PC", 1, 100, { kind: "pc_sum" }) },
        ],
      });
      return { quoteId, svc };
    });
    const copyId = await withTenant(o.orgId, (tx) => duplicateQuote(tx, o.orgId, quoteId));
    await withTenant(o.orgId, async (tx) => {
      const [orig, copy] = [(await getQuote(tx, o.orgId, quoteId))!, (await getQuote(tx, o.orgId, copyId))!];
      expect(copy.quote).toMatchObject({ title: "Original (copy)", status: "draft", markupBps: 1750, vatRateBps: 500, number: orig.quote.number + 1, siteAddress: { postcode: "BA1 1AA" } });
      const strip = (q: typeof orig) => q.sections.map((s) => [s.name, s.lines.map(({ id: _, ...l }) => l)]);
      expect(strip(copy)).toEqual(strip(orig));
      expect(copy.sections[0].lines[0].id).not.toBe(orig.sections[0].lines[0].id);
      expect((await getService(tx, o.orgId, svc))?.service.usageCount).toBe(2);
    });
  });
});

describe("team alerts", () => {
  it("go to whoever sent the quote, or the Admins if they have no email", async () => {
    const o = await newOrg();
    const byEsme = await sentQuote(o.orgId, o.sender, "Esme's", 100);
    const byQuiet = await sentQuote(o.orgId, o.quiet, "Quiet's", 100);
    await withTenant(o.orgId, async (tx) => {
      expect(await alertContext(tx, o.orgId, byEsme.quoteId)).toMatchObject({ to: ["esme@example.com"], title: "Esme's", quoteRef: expect.stringMatching(/^Q-/) });
      expect((await alertContext(tx, o.orgId, byQuiet.quoteId))?.to).toEqual(["ada@example.com"]);
    });
  });
});
