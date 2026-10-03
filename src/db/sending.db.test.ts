/** Sending, the portal, comments and decisions, against real Postgres as the app role. */
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { canonicalJson } from "@/core/quote-snapshot";
import type { QuoteLineInput } from "@/core/schemas";
import { appUrl } from "@/test/db-urls";
import { createClient } from "./clients";
import { closeDb, findPortalAccess, withTenant, type Tx } from "./index";
import { PortalError, addClientComment, decide, portalQuote, portalQuotes, recordView } from "./portal";
import { QuoteError, createQuote, deleteDraft, getQuote, saveQuote } from "./quotes";
import { quoteVersions } from "./schema";
import { addStaffReply, currentPortalToken, ensurePortalToken, quoteActivity, reviseQuote, rotatePortalToken, sendQuote, sha256 } from "./sending";

const clerkId = (uuid: string) => `org_${uuid.replaceAll("-", "")}`;
const line = (name: string, qty: number, ratePence: number): QuoteLineInput => ({ name, qty, unit: "m²", ratePence, markupBps: 1500, noteVisible: false, kind: "normal" });
const reason = (p: Promise<unknown>) =>
  p.then(
    () => "ok",
    (e: unknown) => (e instanceof QuoteError || e instanceof PortalError ? e.reason : String((e as { cause?: { code?: string } }).cause?.code ?? e)),
  );

async function newOrg(name: string) {
  const orgId = randomUUID();
  await withTenant(orgId, (tx) => tx.execute(sql`insert into organizations (id, clerk_org_id, name) values (${orgId}, ${clerkId(orgId)}, ${name})`));
  const memberId = await withTenant(orgId, async (tx) => {
    const rows = await tx.execute<{ id: string }>(sql`insert into members (org_id, clerk_user_id, role, name) values (${orgId}, ${"user_" + orgId.slice(0, 8)}, 'admin', 'Jo') returning id`);
    return rows[0].id;
  });
  return { orgId, memberId };
}

/** A client with a one-line draft quote, ready to send. */
async function draft(orgId: string, title = "Kitchen") {
  return withTenant(orgId, async (tx) => {
    const clientId = await createClient(tx, orgId, { name: "Sarah Hale", email: "sarah@example.com" });
    const quoteId = await createQuote(tx, orgId, { clientId, title });
    const q = (await getQuote(tx, orgId, quoteId))!;
    await saveQuote(tx, orgId, { quoteId, baseVersion: 0, ops: [{ op: "addLine", sectionId: q.sections[0].id, lineId: randomUUID(), position: 0, line: line("Skim", 6.2, 1_450) }] });
    return { clientId, quoteId, number: q.quote.number };
  });
}

const version = async (tx: Tx, orgId: string, quoteId: string) => (await getQuote(tx, orgId, quoteId))!.quote.version;

beforeAll(() => {
  process.env.DATABASE_URL = appUrl();
});
afterAll(async () => {
  await closeDb();
});

describe("sending", () => {
  it("freezes a client-safe version, marks it sent and issues one portal link per client", async () => {
    const { orgId, memberId } = await newOrg("Send");
    const { clientId, quoteId, number } = await draft(orgId);
    const sent = await withTenant(orgId, async (tx) => sendQuote(tx, orgId, { quoteId, baseVersion: await version(tx, orgId, quoteId), memberId }));
    expect(sent).toMatchObject({ versionNo: 1, clientEmail: "sarah@example.com" });
    expect(sent.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(JSON.stringify(sent.snapshot)).not.toMatch(/markup|ratePence/i);
    expect(sent.snapshot.totals.total).toBe(Math.round(10_342 * 1.2));

    await withTenant(orgId, async (tx) => {
      expect((await getQuote(tx, orgId, quoteId))?.quote.status).toBe("sent");
      const [v] = await tx.select().from(quoteVersions).where(sql`${quoteVersions.quoteId} = ${quoteId}`);
      expect(v.contentHash).toBe(sha256(canonicalJson(v.snapshot)));
      // Same client, same link; a second quote doesn't make another.
      expect(await ensurePortalToken(tx, orgId, clientId)).toBe(sent.token);
      // The builder can no longer change it.
      expect(await reason(saveQuote(tx, orgId, { quoteId, baseVersion: await version(tx, orgId, quoteId), ops: [{ op: "renameSection", sectionId: randomUUID(), name: "X" }] }))).toBe("not_editable");
    });
    expect(await findPortalAccess(sent.token)).toMatchObject({ orgId, clientId });
    expect(await findPortalAccess("not-a-token")).toBeNull();
    expect(await findPortalAccess("A".repeat(43))).toBeNull();
    await withTenant(orgId, async (tx) => expect((await portalQuotes(tx, orgId, clientId)).map((q) => [q.number, q.versionNo])).toEqual([[number, 1]]));
  });

  it("refuses an empty quote, a stale version and a second send", async () => {
    const { orgId, memberId } = await newOrg("Send rules");
    const { quoteId } = await draft(orgId);
    expect(await reason(withTenant(orgId, (tx) => sendQuote(tx, orgId, { quoteId, baseVersion: 0, memberId })))).toBe("conflict");
    const empty = await withTenant(orgId, async (tx) => {
      const clientId = await createClient(tx, orgId, { name: "E" });
      return createQuote(tx, orgId, { clientId, title: "Empty" });
    });
    expect(await reason(withTenant(orgId, (tx) => sendQuote(tx, orgId, { quoteId: empty, baseVersion: 0, memberId })))).toBe("empty");
    await withTenant(orgId, async (tx) => sendQuote(tx, orgId, { quoteId, baseVersion: await version(tx, orgId, quoteId), memberId }));
    expect(await reason(withTenant(orgId, async (tx) => sendQuote(tx, orgId, { quoteId, baseVersion: await version(tx, orgId, quoteId), memberId })))).toBe("not_editable");
  });

  it("revises, keeps the client on the last version, and resends as version 2", async () => {
    const { orgId, memberId } = await newOrg("Revise");
    const { clientId, quoteId, number } = await draft(orgId);
    await withTenant(orgId, async (tx) => sendQuote(tx, orgId, { quoteId, baseVersion: await version(tx, orgId, quoteId), memberId }));
    await withTenant(orgId, (tx) => reviseQuote(tx, orgId, quoteId, memberId));
    await withTenant(orgId, async (tx) => {
      const p = (await portalQuote(tx, orgId, clientId, number))!;
      expect(p).toMatchObject({ revising: true, version: { versionNo: 1 } });
      expect(await deleteDraft(tx, orgId, quoteId)).toBe("was_sent");
    });
    expect(await reason(withTenant(orgId, (tx) => decide(tx, orgId, clientId, number, { decision: "accepted", fullName: "Sarah Hale", signature: "Sarah Hale", agree: true }, { ip: null, userAgent: null })))).toBe("not_open");
    await withTenant(orgId, async (tx) => sendQuote(tx, orgId, { quoteId, baseVersion: await version(tx, orgId, quoteId), memberId }));
    await withTenant(orgId, async (tx) => expect((await portalQuote(tx, orgId, clientId, number))).toMatchObject({ revising: false, version: { versionNo: 2 } }));
  });
});

describe("portal", () => {
  it("counts opens once per half hour and moves sent to viewed", async () => {
    const { orgId, memberId } = await newOrg("Views");
    const { clientId, quoteId, number } = await draft(orgId);
    const { token } = await withTenant(orgId, async (tx) => sendQuote(tx, orgId, { quoteId, baseVersion: await version(tx, orgId, quoteId), memberId }));
    const access = (await findPortalAccess(token))!;
    await withTenant(orgId, async (tx) => {
      expect(await recordView(tx, orgId, access, number)).toEqual({ quoteId, first: true });
      expect(await recordView(tx, orgId, access, number)).toBe(false);
      expect((await getQuote(tx, orgId, quoteId))?.quote.status).toBe("viewed");
      expect(await quoteActivity(tx, orgId, quoteId)).toMatchObject({ viewCount: 1 });
      expect(await reason(recordView(tx, orgId, access, 999))).toBe("not_found");
    });
    expect(clientId).toBe(access.clientId);
  });

  it("takes comments (on a line or the quote) and team replies, with a rate limit", async () => {
    const { orgId, memberId } = await newOrg("Comments");
    const { clientId, quoteId, number } = await draft(orgId);
    const sent = await withTenant(orgId, async (tx) => sendQuote(tx, orgId, { quoteId, baseVersion: await version(tx, orgId, quoteId), memberId }));
    const lineId = sent.snapshot.sections[0].lines[0].id;
    await withTenant(orgId, async (tx) => {
      await addClientComment(tx, orgId, clientId, number, { name: "Sarah", body: "Can we use oak?", lineId });
      await addStaffReply(tx, orgId, { quoteId, body: "Yes, +£200.", memberId, memberName: "Jo" });
      const p = (await portalQuote(tx, orgId, clientId, number))!;
      expect(p.comments.map((c) => [c.authorKind, c.authorName, c.body, c.lineId])).toEqual([
        ["client", "Sarah", "Can we use oak?", lineId],
        ["staff", "Jo", "Yes, +£200.", null],
      ]);
    });
    expect(await reason(withTenant(orgId, (tx) => addClientComment(tx, orgId, clientId, number, { name: "S", body: "x", lineId: randomUUID() })))).toBe("unknown_line");
    await withTenant(orgId, async (tx) => {
      for (let i = 0; i < 19; i++) await addClientComment(tx, orgId, clientId, number, { name: "S", body: `n${i}` });
    });
    expect(await reason(withTenant(orgId, (tx) => addClientComment(tx, orgId, clientId, number, { name: "S", body: "one too many" })))).toBe("too_many");
  });

  it("records an acceptance with its evidence, once, and not after expiry", async () => {
    const { orgId, memberId } = await newOrg("Accept");
    const { clientId, quoteId, number } = await draft(orgId);
    const sent = await withTenant(orgId, async (tx) => sendQuote(tx, orgId, { quoteId, baseVersion: await version(tx, orgId, quoteId), memberId }));
    await withTenant(orgId, (tx) => decide(tx, orgId, clientId, number, { decision: "accepted", fullName: "Sarah Hale", signature: "S. Hale", agree: true }, { ip: "203.0.113.7", userAgent: "Test" }));
    await withTenant(orgId, async (tx) => {
      const a = await quoteActivity(tx, orgId, quoteId);
      const [v] = await tx.select({ hash: quoteVersions.contentHash }).from(quoteVersions).where(sql`${quoteVersions.quoteId} = ${quoteId}`);
      expect(a.decisions).toEqual([expect.objectContaining({ decision: "accepted", fullName: "Sarah Hale", signature: "S. Hale", ip: "203.0.113.7", contentHash: v.hash })]);
      expect((await getQuote(tx, orgId, quoteId))?.quote).toMatchObject({ status: "accepted", acceptedAt: expect.any(Date) });
      expect(a.events.map((e) => e.kind)).toEqual(["sent", "accepted"]);
    });
    expect(await reason(withTenant(orgId, (tx) => decide(tx, orgId, clientId, number, { decision: "declined", fullName: "Sarah Hale" }, { ip: null, userAgent: null })))).toBe("decided");
    expect(await reason(withTenant(orgId, (tx) => reviseQuote(tx, orgId, quoteId, memberId)))).toBe("not_editable");
    expect(sent.versionNo).toBe(1);

    // An expired quote can't be accepted.
    const old = await draft(orgId, "Old");
    await withTenant(orgId, async (tx) => {
      await saveQuote(tx, orgId, { quoteId: old.quoteId, baseVersion: await version(tx, orgId, old.quoteId), ops: [], header: { clientId: old.clientId, title: "Old", markupBps: 0, vatRateBps: 2000, validUntil: "2020-01-01" } });
      await sendQuote(tx, orgId, { quoteId: old.quoteId, baseVersion: await version(tx, orgId, old.quoteId), memberId });
    });
    expect(await reason(withTenant(orgId, (tx) => decide(tx, orgId, old.clientId, old.number, { decision: "accepted", fullName: "S", signature: "S", agree: true }, { ip: null, userAgent: null })))).toBe("expired");
  });

  it("keeps records append-only and links revocable", async () => {
    const { orgId, memberId } = await newOrg("Records");
    const { clientId, quoteId } = await draft(orgId);
    const sent = await withTenant(orgId, async (tx) => sendQuote(tx, orgId, { quoteId, baseVersion: await version(tx, orgId, quoteId), memberId }));
    const raw = postgres(appUrl(), { max: 1, onnotice: () => {} });
    try {
      for (const stmt of ["update quote_versions set total_pence = 1", "delete from quote_versions", "delete from quote_events", "update quote_decisions set signature = 'x'", "delete from portal_access", "update portal_access set token = 'x'"]) {
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
    const fresh = await withTenant(orgId, (tx) => rotatePortalToken(tx, orgId, clientId));
    expect(fresh).not.toBe(sent.token);
    expect(await findPortalAccess(sent.token)).toBeNull();
    expect(await findPortalAccess(fresh)).toMatchObject({ clientId });
    await withTenant(orgId, async (tx) => expect(await currentPortalToken(tx, orgId, clientId)).toBe(fresh));
  });

  it("never shows one client another client's quotes, or another company's", async () => {
    const a = await newOrg("Portal A");
    const one = await draft(a.orgId, "Mine");
    const two = await draft(a.orgId, "Theirs");
    await withTenant(a.orgId, async (tx) => {
      await sendQuote(tx, a.orgId, { quoteId: one.quoteId, baseVersion: await version(tx, a.orgId, one.quoteId), memberId: a.memberId });
      await sendQuote(tx, a.orgId, { quoteId: two.quoteId, baseVersion: await version(tx, a.orgId, two.quoteId), memberId: a.memberId });
      // Client one can't reach client two's quote by number.
      expect(await portalQuote(tx, a.orgId, one.clientId, two.number)).toBeUndefined();
      expect((await portalQuotes(tx, a.orgId, one.clientId)).map((q) => q.title)).toEqual(["Mine"]);
    });
    const b = await newOrg("Portal B");
    await withTenant(b.orgId, async (tx) => {
      // Inside company B's tenant, company A's client and quotes don't exist.
      expect(await portalQuotes(tx, b.orgId, one.clientId)).toEqual([]);
      expect(await portalQuote(tx, a.orgId, one.clientId, one.number)).toBeUndefined();
    });
  });
});
