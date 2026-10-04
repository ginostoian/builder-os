/**
 * Protection for public forms and actions, without a captcha:
 *
 * - **Rate limits** per caller (IP address) and per target (an email address, a link), counted in
 *   Postgres so they hold across serverless instances. Keys are HMACs: no IP or email is stored.
 * - **Form tokens**: a form rendered by the server carries a signed issue time. A submission without a
 *   valid token, or faster than a person could fill the form in, or older than a day, is a bot. Unlike a
 *   time the browser reports, a bot can't fake it without loading the page and waiting.
 *
 * If the database can't count (an outage), limits let requests through rather than lock everyone out.
 */
import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";
import { hitRateLimit } from "@/db";

/** Signing key: APP_SECRET, else one derived from Clerk's secret (always set in deployed environments). */
function secret(): string {
  const own = process.env.APP_SECRET?.trim();
  if (own) return own;
  const clerk = process.env.CLERK_SECRET_KEY?.trim();
  if (clerk) return createHash("sha256").update(`builderos-app-secret:${clerk}`).digest("hex");
  if (process.env.NODE_ENV === "production") throw new Error("APP_SECRET (or CLERK_SECRET_KEY) must be set.");
  return "builderos-development-only-secret";
}

const hmac = (value: string) => createHmac("sha256", secret()).update(value).digest("hex");

/** The caller's IP address as the platform reports it (Vercel sets these; a client can't). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-real-ip")?.trim() || h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export type Limit = { bucket: string; subject: string; max: number; windowSeconds: number };

/** Count one attempt against each limit; false if any is over. All are counted, so retrying doesn't help. */
export async function allow(...limits: Limit[]): Promise<boolean> {
  let ok = true;
  for (const l of limits) {
    try {
      const { allowed } = await hitRateLimit(`${l.bucket}:${hmac(`${l.bucket}\n${l.subject.toLowerCase()}`)}`, l.max, l.windowSeconds);
      if (!allowed) ok = false;
    } catch (error) {
      console.error("Rate limit check failed", error instanceof Error ? error.message : error);
    }
  }
  return ok;
}

/** A per-IP limit for this request. */
export async function perIp(bucket: string, max: number, windowSeconds: number): Promise<Limit> {
  return { bucket, subject: await clientIp(), max, windowSeconds };
}

// ── Form tokens ──────────────────────────────────────────────────────────────

const MIN_FILL_MS = 3_000;
const MAX_AGE_MS = 24 * 60 * 60_000;

/** A token for a form being rendered now. `form` names it (and the record it's for), e.g. `enquiry:<token>`. */
export function formToken(form: string, now = Date.now()): string {
  return `${now}.${hmac(`form\n${form}\n${now}`)}`;
}

/**
 * Whether a submitted form token is genuine, and old enough to have been filled in by a person. `expired`
 * is a real page left open over a day: ask them to reload, don't drop it silently.
 */
export function checkFormToken(form: string, token: unknown, now = Date.now()): "ok" | "too_fast" | "expired" | "invalid" {
  if (typeof token !== "string" || token.length > 120) return "invalid";
  const [at, sig] = token.split(".");
  const issued = Number(at);
  if (!Number.isSafeInteger(issued) || !sig || !/^[0-9a-f]{64}$/.test(sig)) return "invalid";
  const expected = Buffer.from(hmac(`form\n${form}\n${issued}`));
  if (!timingSafeEqual(expected, Buffer.from(sig))) return "invalid";
  const age = now - issued;
  if (age < 0) return "invalid";
  if (age > MAX_AGE_MS) return "expired";
  return age < MIN_FILL_MS ? "too_fast" : "ok";
}

/** Text that looks like spam: several links, or link markup, in a free-text field. */
export function looksLikeSpam(...texts: (string | null | undefined)[]): boolean {
  const all = texts.filter(Boolean).join("\n");
  const links = all.match(/https?:\/\/|www\./gi)?.length ?? 0;
  return links >= 3 || /\[url=|<a\s+href=/i.test(all);
}
