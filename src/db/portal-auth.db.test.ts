/** Portal sign-in: codes, one-time links, remembered devices, limits, "find my portal", and isolation. */
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { appUrl } from "@/test/db-urls";
import { createClient } from "./clients";
import { closeDb, findPortalAccess, findPortalAccessesByEmail, withTenant } from "./index";
import {
  CODES_PER_HOUR,
  PortalAuthError,
  checkPortalSession,
  createPortalSession,
  createSignInCode,
  createSignInLink,
  endPortalSession,
  maskEmail,
  portalDevices,
  portalSignInState,
  setPortalSignIn,
  signOutEverywhere,
  spendSignInCode,
  spendSignInLink,
} from "./portal-auth";
import { ensurePortalToken, rotatePortalToken } from "./sending";

const clerkId = (uuid: string) => `org_${uuid.replaceAll("-", "")}`;
const reason = (p: Promise<unknown>) =>
  p.then(
    (r) => (typeof r === "string" && ["wrong_code", "expired"].includes(r) ? r : "ok"),
    (e: unknown) => (e instanceof PortalAuthError ? e.reason : String((e as { cause?: { code?: string } }).cause?.code ?? e)),
  );

async function setup(name: string, email: string | null = "sarah@example.com") {
  const orgId = randomUUID();
  await withTenant(orgId, (tx) => tx.execute(sql`insert into organizations (id, clerk_org_id, name) values (${orgId}, ${clerkId(orgId)}, ${name})`));
  const { clientId, token } = await withTenant(orgId, async (tx) => {
    const clientId = await createClient(tx, orgId, { name: "Sarah Hale", email: email ?? undefined });
    return { clientId, token: await ensurePortalToken(tx, orgId, clientId) };
  });
  const access = (await findPortalAccess(token))!;
  return { orgId, clientId, token, accessId: access.accessId };
}

beforeAll(() => {
  process.env.DATABASE_URL = appUrl();
});
afterAll(async () => {
  await closeDb();
});

describe("portal sign-in", () => {
  it("needs sign-in only when the company has it on and the client has an email", async () => {
    const a = await setup("Auth state");
    const none = await setup("Auth no email", null);
    expect((await withTenant(a.orgId, (tx) => portalSignInState(tx, a.orgId, a.clientId)))?.required).toBe(true);
    expect((await withTenant(none.orgId, (tx) => portalSignInState(tx, none.orgId, none.clientId)))?.required).toBe(false);
    await withTenant(a.orgId, (tx) => setPortalSignIn(tx, a.orgId, false));
    expect((await withTenant(a.orgId, (tx) => portalSignInState(tx, a.orgId, a.clientId)))?.required).toBe(false);
    expect(maskEmail("sarah@example.com")).toBe("s••••@example.com");
  });

  it("accepts the latest code once, and spends it after five wrong tries", async () => {
    const a = await setup("Auth codes");
    const first = await withTenant(a.orgId, (tx) => createSignInCode(tx, a.orgId, a.accessId));
    const code = await withTenant(a.orgId, (tx) => createSignInCode(tx, a.orgId, a.accessId));
    expect(code).toMatch(/^\d{6}$/);
    // A newer code replaces the old one.
    if (first !== code) expect(await reason(withTenant(a.orgId, (tx) => spendSignInCode(tx, a.orgId, a.accessId, first)))).toBe("wrong_code");
    expect(await reason(withTenant(a.orgId, (tx) => spendSignInCode(tx, a.orgId, a.accessId, `${code.slice(0, 3)} ${code.slice(3)}`)))).toBe("ok");
    expect(await reason(withTenant(a.orgId, (tx) => spendSignInCode(tx, a.orgId, a.accessId, code)))).toBe("expired");

    const again = await withTenant(a.orgId, (tx) => createSignInCode(tx, a.orgId, a.accessId));
    const wrong = again === "000000" ? "111111" : "000000";
    for (let i = 0; i < 4; i++) expect(await reason(withTenant(a.orgId, (tx) => spendSignInCode(tx, a.orgId, a.accessId, wrong)))).toBe("wrong_code");
    expect(await reason(withTenant(a.orgId, (tx) => spendSignInCode(tx, a.orgId, a.accessId, wrong)))).toBe("expired");
    // Even the right code is no good now.
    expect(await reason(withTenant(a.orgId, (tx) => spendSignInCode(tx, a.orgId, a.accessId, again)))).toBe("expired");
  });

  it("limits how many codes and links one portal can ask for in an hour", async () => {
    const a = await setup("Auth limit");
    for (let i = 0; i < CODES_PER_HOUR; i++) await withTenant(a.orgId, (tx) => (i % 2 ? createSignInCode(tx, a.orgId, a.accessId) : createSignInLink(tx, a.orgId, a.accessId, 30)));
    expect(await reason(withTenant(a.orgId, (tx) => createSignInCode(tx, a.orgId, a.accessId)))).toBe("too_many");
  });

  it("spends a sign-in link once, and remembers the device until it signs out", async () => {
    const a = await setup("Auth links");
    const secret = await withTenant(a.orgId, (tx) => createSignInLink(tx, a.orgId, a.accessId, 30));
    expect(await reason(withTenant(a.orgId, (tx) => spendSignInLink(tx, a.orgId, a.accessId, secret)))).toBe("ok");
    expect(await reason(withTenant(a.orgId, (tx) => spendSignInLink(tx, a.orgId, a.accessId, secret)))).toBe("expired");
    const expired = await withTenant(a.orgId, (tx) => createSignInLink(tx, a.orgId, a.accessId, -1));
    expect(await reason(withTenant(a.orgId, (tx) => spendSignInLink(tx, a.orgId, a.accessId, expired)))).toBe("expired");

    const device = await withTenant(a.orgId, (tx) => createPortalSession(tx, a.orgId, a.accessId, "Safari on iPhone"));
    const other = await withTenant(a.orgId, (tx) => createPortalSession(tx, a.orgId, a.accessId, "Chrome"));
    expect(await withTenant(a.orgId, (tx) => checkPortalSession(tx, a.orgId, a.accessId, device))).toBe(true);
    expect(await withTenant(a.orgId, (tx) => checkPortalSession(tx, a.orgId, a.accessId, "nope"))).toBe(false);
    expect((await withTenant(a.orgId, (tx) => portalDevices(tx, a.orgId, a.clientId))).length).toBe(2);
    await withTenant(a.orgId, (tx) => endPortalSession(tx, a.orgId, a.accessId, device));
    expect(await withTenant(a.orgId, (tx) => checkPortalSession(tx, a.orgId, a.accessId, device))).toBe(false);
    expect(await withTenant(a.orgId, (tx) => signOutEverywhere(tx, a.orgId, a.clientId))).toBe(1);
    expect(await withTenant(a.orgId, (tx) => checkPortalSession(tx, a.orgId, a.accessId, other))).toBe(false);

    // Resetting the link signs everyone out: the new link has no sessions.
    await withTenant(a.orgId, (tx) => createPortalSession(tx, a.orgId, a.accessId, null));
    const fresh = await withTenant(a.orgId, (tx) => rotatePortalToken(tx, a.orgId, a.clientId));
    expect(await findPortalAccess(a.token)).toBeNull();
    const newAccess = (await findPortalAccess(fresh))!;
    expect(newAccess.accessId).not.toBe(a.accessId);
    expect((await withTenant(a.orgId, (tx) => portalDevices(tx, a.orgId, a.clientId))).length).toBe(0);
  });

  it("finds portals by email across companies, never archived clients or reset links", async () => {
    const email = `find-${randomUUID().slice(0, 8)}@example.com`;
    const a = await setup("Find A", email);
    const b = await setup("Find B", email.toUpperCase());
    const found = await findPortalAccessesByEmail(email);
    expect(found.map((f) => f.orgId).sort()).toEqual([a.orgId, b.orgId].sort());
    await withTenant(b.orgId, (tx) => tx.execute(sql`update clients set archived_at = now() where id = ${b.clientId}`));
    expect((await findPortalAccessesByEmail(email)).map((f) => f.orgId)).toEqual([a.orgId]);
    await withTenant(a.orgId, (tx) => rotatePortalToken(tx, a.orgId, a.clientId));
    const after = await findPortalAccessesByEmail(email);
    expect(after.map((f) => f.orgId)).toEqual([a.orgId]);
    expect(after[0].accessId).not.toBe(a.accessId);
    expect(await findPortalAccessesByEmail("not an email")).toEqual([]);
  });

  it("keeps codes and sessions to their own company", async () => {
    const a = await setup("Iso A");
    const b = await setup("Iso B");
    const device = await withTenant(a.orgId, (tx) => createPortalSession(tx, a.orgId, a.accessId, null));
    await withTenant(a.orgId, (tx) => createSignInCode(tx, a.orgId, a.accessId));
    expect(await withTenant(b.orgId, async (tx) => (await tx.execute(sql`select id from portal_sessions union all select id from portal_codes`)).length)).toBe(0);
    // B can't check A's session, even knowing A's ids and secret.
    expect(await withTenant(b.orgId, (tx) => checkPortalSession(tx, a.orgId, a.accessId, device))).toBe(false);
    // Nor can B attach a session to A's link.
    expect(await reason(withTenant(b.orgId, (tx) => createPortalSession(tx, b.orgId, a.accessId, null)))).toBe("23503");
  });
});
