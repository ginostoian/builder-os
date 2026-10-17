/**
 * The OAuth "state" for connecting Xero: a random value in a short-lived, signed, HttpOnly cookie, tied
 * to the company, so the callback only accepts the connection this person started for this company.
 */
import "server-only";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { appSignature } from "../rate-limit";

const COOKIE = "bos_xero_state";
const sign = (nonce: string, orgId: string) => appSignature(`xero-state:${nonce}:${orgId}`);

export async function startXeroState(orgId: string): Promise<string> {
  const nonce = randomBytes(24).toString("base64url");
  (await cookies()).set(COOKIE, `${nonce}.${orgId}.${sign(nonce, orgId)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/xero",
    maxAge: 600,
  });
  return nonce;
}

/** True when `state` is the one we handed out for this company. The cookie is used up either way. */
export async function checkXeroState(state: string | null, orgId: string): Promise<boolean> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  jar.set(COOKIE, "", { path: "/api/xero", maxAge: 0 });
  const [nonce, org, sig] = raw?.split(".") ?? [];
  if (!state || !nonce || !org || !sig || org !== orgId) return false;
  const expected = Buffer.from(sign(nonce, orgId));
  const given = Buffer.from(sig);
  const a = Buffer.from(state);
  const b = Buffer.from(nonce);
  return expected.length === given.length && timingSafeEqual(expected, given) && a.length === b.length && timingSafeEqual(a, b);
}

export const xeroRedirectUri = (origin: string) => `${origin}/api/xero/callback`;
