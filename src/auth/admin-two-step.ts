/**
 * Two-step verification for the website owner's admin area, without a paid Clerk plan: each admin adds
 * an authenticator app once (the key lives in their Clerk user's private metadata, which only our server
 * can read), then types its 6-digit code at /admin. A right code sets a signed, httpOnly cookie for this
 * browser that lasts 12 hours. The cookie names the person and the key, so it's no use to anyone else
 * and stops working if the key is reset.
 *
 * Lost phone: in the Clerk dashboard, open the user, Metadata, Private, and delete `adminTotp`. They're
 * asked to set up an app again next time.
 */
import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { clerkClient, currentUser } from "@clerk/nextjs/server";
import { appSignature } from "@/server/rate-limit";

export const ADMIN_COOKIE = "bos_admin_2fa";
export const ADMIN_COOKIE_HOURS = 12;
const SETUP_MINUTES = 30;

/** What we keep on the Clerk user. `lastStep` is the last code used, so none is accepted twice. */
export type AdminTotp = { secret: string; lastStep: number; addedAt: string };

export function storedTotp(privateMetadata: unknown): AdminTotp | null {
  const t = (privateMetadata as { adminTotp?: Partial<AdminTotp> } | null)?.adminTotp;
  if (!t || typeof t.secret !== "string" || !/^[A-Z2-7]{16,}$/.test(t.secret)) return null;
  return {
    secret: t.secret,
    lastStep: typeof t.lastStep === "number" ? t.lastStep : -1,
    addedAt: typeof t.addedAt === "string" ? t.addedAt : "",
  };
}

/** The signed-in user's key, and the last code they used. */
export async function readTotp(): Promise<AdminTotp | null> {
  return storedTotp((await currentUser())?.privateMetadata);
}

export async function saveTotp(userId: string, totp: AdminTotp): Promise<void> {
  const client = await clerkClient();
  await client.users.updateUserMetadata(userId, {
    privateMetadata: { adminTotp: totp },
  });
}

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** A short fingerprint of the key, so a cookie made with an old key stops working when it's replaced. */
const keyTag = (secret: string) => createHash("sha256").update(secret).digest("hex").slice(0, 16);

// ── The 12-hour cookie ──────────────────────────────────────────────────────

export function adminPass(userId: string, secret: string, now = Date.now()): string {
  const expires = now + ADMIN_COOKIE_HOURS * 3_600_000;
  return `${expires}.${appSignature(`admin_pass\n${userId}\n${keyTag(secret)}\n${expires}`)}`;
}

export function checkAdminPass(value: string | undefined, userId: string, secret: string, now = Date.now()): boolean {
  if (!value || value.length > 120) return false;
  const [at, sig] = value.split(".");
  const expires = Number(at);
  if (!Number.isSafeInteger(expires) || !sig || expires <= now || expires > now + ADMIN_COOKIE_HOURS * 3_600_000) return false;
  return same(sig, appSignature(`admin_pass\n${userId}\n${keyTag(secret)}\n${expires}`));
}

export async function hasAdminPass(userId: string, secret: string): Promise<boolean> {
  return checkAdminPass((await cookies()).get(ADMIN_COOKIE)?.value, userId, secret);
}

export async function setAdminPass(userId: string, secret: string): Promise<void> {
  (await cookies()).set(ADMIN_COOKIE, adminPass(userId, secret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/admin",
    maxAge: ADMIN_COOKIE_HOURS * 3_600,
  });
}

export async function clearAdminPass(): Promise<void> {
  (await cookies()).set(ADMIN_COOKIE, "", { path: "/admin", maxAge: 0 });
}

// ── Setting up an app ───────────────────────────────────────────────────────

/**
 * While someone sets up their app, the new key travels in the page and comes back with their first code.
 * This signature proves we made it for them, recently, so nobody can slip in a key of their own.
 */
export function setupToken(userId: string, secret: string, now = Date.now()): string {
  return `${now}.${appSignature(`admin_totp_setup\n${userId}\n${secret}\n${now}`)}`;
}

export function checkSetupToken(token: unknown, userId: string, secret: unknown, now = Date.now()): boolean {
  if (typeof token !== "string" || typeof secret !== "string" || token.length > 120 || !/^[A-Z2-7]{32}$/.test(secret)) return false;
  const [at, sig] = token.split(".");
  const issued = Number(at);
  if (!Number.isSafeInteger(issued) || !sig || issued > now || now - issued > SETUP_MINUTES * 60_000) return false;
  return same(sig, appSignature(`admin_totp_setup\n${userId}\n${secret}\n${issued}`));
}
