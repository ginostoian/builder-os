/**
 * Signing in to the client portal. The portal link is the address; on a new device the client also proves
 * they can read their email, with a 6-digit code or a one-time sign-in link. The device is then remembered
 * (a random secret in an httpOnly cookie; only its SHA-256 is stored here) for 90 days.
 *
 * Everything runs inside the company's tenant, after the portal token has been resolved.
 */
import "server-only";
import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { and, count, desc, eq, gt, gte, inArray, isNull, sql } from "drizzle-orm";
import type { Tx } from "./index";
import { clients, organizations, portalAccess, portalCodes, portalSessions } from "./schema";

export const SESSION_DAYS = 90;
export const CODE_MINUTES = 10;
export const CODE_ATTEMPTS = 5;
/** New codes or links per portal link per hour, so nobody can flood a client's inbox. */
export const CODES_PER_HOUR = 6;

export type PortalAuthErrorReason = "too_many" | "wrong_code" | "expired" | "no_email";

export class PortalAuthError extends Error {
  constructor(readonly reason: PortalAuthErrorReason) {
    super(reason);
  }
}

const hash = (accessId: string, secret: string) => createHash("sha256").update(`${accessId}:${secret}`).digest("hex");

/**
 * Whether opening this client's portal needs a sign-in. Only when the company has it on and the client has
 * an email to send a code to (otherwise the link alone opens it, as before).
 */
export async function portalSignInState(tx: Tx, orgId: string, clientId: string) {
  const [row] = await tx
    .select({ on: organizations.portalSignIn, email: clients.email, company: organizations.name, tradingName: organizations.tradingName, logoUrl: organizations.logoUrl, brandColour: organizations.brandColour })
    .from(clients)
    .innerJoin(organizations, eq(organizations.id, clients.orgId))
    .where(and(eq(clients.orgId, orgId), eq(clients.id, clientId)));
  if (!row) return null;
  return { required: row.on && Boolean(row.email), email: row.email, company: { name: row.tradingName ?? row.company, logoUrl: row.logoUrl, brandColour: row.brandColour } };
}

/** "s•••@example.com": enough to recognise, not enough to learn. */
export function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  return `${user.slice(0, 1)}${"•".repeat(Math.max(2, Math.min(user.length - 1, 5)))}@${domain}`;
}

async function underLimit(tx: Tx, orgId: string, accessId: string) {
  const [{ n }] = await tx
    .select({ n: count() })
    .from(portalCodes)
    .where(and(eq(portalCodes.orgId, orgId), eq(portalCodes.accessId, accessId), gte(portalCodes.createdAt, sql`now() - interval '1 hour'`)));
  if (n >= CODES_PER_HOUR) throw new PortalAuthError("too_many");
}

/** A fresh 6-digit code for this portal link (earlier ones stop working). */
export async function createSignInCode(tx: Tx, orgId: string, accessId: string): Promise<string> {
  await underLimit(tx, orgId, accessId);
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await tx.update(portalCodes).set({ usedAt: new Date() }).where(and(eq(portalCodes.orgId, orgId), eq(portalCodes.accessId, accessId), eq(portalCodes.kind, "code"), isNull(portalCodes.usedAt)));
  await tx.insert(portalCodes).values({ orgId, accessId, kind: "code", secretHash: hash(accessId, code), expiresAt: new Date(Date.now() + CODE_MINUTES * 60_000) });
  return code;
}

/** A one-time sign-in link secret, for emails. `minutes`: how long it works (a week for quote emails). */
export async function createSignInLink(tx: Tx, orgId: string, accessId: string, minutes: number): Promise<string> {
  await underLimit(tx, orgId, accessId);
  const secret = randomBytes(24).toString("base64url");
  await tx.insert(portalCodes).values({ orgId, accessId, kind: "link", secretHash: hash(accessId, secret), expiresAt: new Date(Date.now() + minutes * 60_000) });
  return secret;
}

/**
 * Check a typed code. Five wrong tries and the code is spent. Returns rather than throws on a wrong code,
 * so the attempt count is saved with the transaction.
 */
export async function spendSignInCode(tx: Tx, orgId: string, accessId: string, code: string): Promise<"ok" | "wrong_code" | "expired"> {
  const [c] = await tx
    .select({ id: portalCodes.id, secretHash: portalCodes.secretHash, attempts: portalCodes.attempts, expiresAt: portalCodes.expiresAt })
    .from(portalCodes)
    .where(and(eq(portalCodes.orgId, orgId), eq(portalCodes.accessId, accessId), eq(portalCodes.kind, "code"), isNull(portalCodes.usedAt)))
    .orderBy(desc(portalCodes.createdAt))
    .limit(1);
  if (!c || c.expiresAt.getTime() < Date.now() || c.attempts >= CODE_ATTEMPTS) return "expired";
  const given = Buffer.from(hash(accessId, code.replace(/\D/g, "")));
  if (!timingSafeEqual(given, Buffer.from(c.secretHash))) {
    const attempts = c.attempts + 1;
    await tx.update(portalCodes).set({ attempts, ...(attempts >= CODE_ATTEMPTS ? { usedAt: new Date() } : {}) }).where(and(eq(portalCodes.orgId, orgId), eq(portalCodes.id, c.id)));
    return attempts >= CODE_ATTEMPTS ? "expired" : "wrong_code";
  }
  await tx.update(portalCodes).set({ usedAt: new Date() }).where(and(eq(portalCodes.orgId, orgId), eq(portalCodes.id, c.id)));
  return "ok";
}

/** Spend a sign-in link. */
export async function spendSignInLink(tx: Tx, orgId: string, accessId: string, secret: string): Promise<void> {
  const rows = await tx
    .update(portalCodes)
    .set({ usedAt: new Date() })
    .where(and(eq(portalCodes.orgId, orgId), eq(portalCodes.accessId, accessId), eq(portalCodes.kind, "link"), eq(portalCodes.secretHash, hash(accessId, secret)), isNull(portalCodes.usedAt), gt(portalCodes.expiresAt, new Date())))
    .returning({ id: portalCodes.id });
  if (rows.length === 0) throw new PortalAuthError("expired");
}

/** Remember this device. Returns the secret for the cookie. */
export async function createPortalSession(tx: Tx, orgId: string, accessId: string, userAgent: string | null): Promise<string> {
  const secret = randomBytes(32).toString("base64url");
  await tx.insert(portalSessions).values({ orgId, accessId, secretHash: hash(accessId, secret), userAgent: userAgent?.slice(0, 300) ?? null, expiresAt: new Date(Date.now() + SESSION_DAYS * 86_400_000) });
  // Old sessions of this link tidy themselves away.
  await tx.delete(portalSessions).where(and(eq(portalSessions.orgId, orgId), eq(portalSessions.accessId, accessId), sql`${portalSessions.expiresAt} < now()`));
  return secret;
}

/** Whether this cookie secret is a live session for the link. Touches it at most once an hour. */
export async function checkPortalSession(tx: Tx, orgId: string, accessId: string, secret: string): Promise<boolean> {
  const [s] = await tx
    .select({ id: portalSessions.id, lastSeenAt: portalSessions.lastSeenAt })
    .from(portalSessions)
    .where(and(eq(portalSessions.orgId, orgId), eq(portalSessions.accessId, accessId), eq(portalSessions.secretHash, hash(accessId, secret)), gt(portalSessions.expiresAt, new Date())));
  if (!s) return false;
  if (Date.now() - s.lastSeenAt.getTime() > 3_600_000) await tx.update(portalSessions).set({ lastSeenAt: new Date() }).where(and(eq(portalSessions.orgId, orgId), eq(portalSessions.id, s.id)));
  return true;
}

export async function endPortalSession(tx: Tx, orgId: string, accessId: string, secret: string) {
  await tx.delete(portalSessions).where(and(eq(portalSessions.orgId, orgId), eq(portalSessions.accessId, accessId), eq(portalSessions.secretHash, hash(accessId, secret))));
}

/** Devices signed in to this client's portal (for the office). */
export async function portalDevices(tx: Tx, orgId: string, clientId: string) {
  return tx
    .select({ id: portalSessions.id, userAgent: portalSessions.userAgent, createdAt: portalSessions.createdAt, lastSeenAt: portalSessions.lastSeenAt })
    .from(portalSessions)
    .innerJoin(portalAccess, and(eq(portalAccess.orgId, portalSessions.orgId), eq(portalAccess.id, portalSessions.accessId)))
    .where(and(eq(portalSessions.orgId, orgId), eq(portalAccess.clientId, clientId), isNull(portalAccess.revokedAt), gt(portalSessions.expiresAt, new Date())))
    .orderBy(desc(portalSessions.lastSeenAt));
}

/** Sign the client out everywhere (e.g. a shared computer, or a forwarded email). */
export async function signOutEverywhere(tx: Tx, orgId: string, clientId: string): Promise<number> {
  const links = await tx.select({ id: portalAccess.id }).from(portalAccess).where(and(eq(portalAccess.orgId, orgId), eq(portalAccess.clientId, clientId)));
  if (links.length === 0) return 0;
  const gone = await tx
    .delete(portalSessions)
    .where(and(eq(portalSessions.orgId, orgId), inArray(portalSessions.accessId, links.map((l) => l.id))))
    .returning({ id: portalSessions.id });
  return gone.length;
}

/** The active link behind a token, inside the tenant (for adding a sign-in to an emailed link). */
export async function accessForToken(tx: Tx, orgId: string, token: string) {
  const [a] = await tx.select({ id: portalAccess.id, clientId: portalAccess.clientId }).from(portalAccess).where(and(eq(portalAccess.orgId, orgId), eq(portalAccess.token, token), isNull(portalAccess.revokedAt)));
  return a ?? null;
}

export async function setPortalSignIn(tx: Tx, orgId: string, on: boolean) {
  await tx.update(organizations).set({ portalSignIn: on }).where(eq(organizations.id, orgId));
}

export async function getPortalSignIn(tx: Tx, orgId: string): Promise<boolean> {
  const [o] = await tx.select({ on: organizations.portalSignIn }).from(organizations).where(eq(organizations.id, orgId));
  return o?.on ?? true;
}
