/**
 * Authenticator app codes (TOTP, RFC 6238): the 6-digit codes Google Authenticator, Microsoft
 * Authenticator, 1Password and the like show every 30 seconds. Used for the website owner's admin area,
 * so it has two-step verification without a paid Clerk plan.
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export const STEP_SECONDS = 30;

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

/** Null if it isn't base32 (spaces and lower case are fine: people type keys in). */
export function base32Decode(text: string): Buffer | null {
  const clean = text.replace(/[\s=]/g, "").toUpperCase();
  if (!/^[A-Z2-7]+$/.test(clean)) return null;
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const c of clean) {
    value = (value << 5) | ALPHABET.indexOf(c);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** A new random key (160 bits, as the RFC recommends), in base32. */
export const newTotpSecret = () => base32Encode(randomBytes(20));

/** The 30-second step a moment falls in. */
export const totpStep = (now: number) => Math.floor(now / 1000 / STEP_SECONDS);

/** The code for one step. */
export function totpCode(secret: string, step: number): string {
  const key = base32Decode(secret);
  if (!key) throw new Error("Not a base32 key.");
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const mac = createHmac("sha1", key).update(counter).digest();
  const offset = mac[mac.length - 1]! & 15;
  const n = mac.readUInt32BE(offset) & 0x7fffffff;
  return String(n % 1_000_000).padStart(6, "0");
}

/**
 * The step a typed code matches, allowing for a phone clock half a minute either way, or null. A code
 * from a step already used (`lastStep` or before) is refused, so a code seen over someone's shoulder
 * can't be used again.
 */
export function verifyTotp(secret: string, code: string, now: number, lastStep = -1): number | null {
  const digits = code.replace(/[\s-]/g, "");
  if (!/^\d{6}$/.test(digits)) return null;
  const current = totpStep(now);
  for (const step of [current, current - 1, current + 1]) {
    if (step <= lastStep) continue;
    if (timingSafeEqual(Buffer.from(totpCode(secret, step)), Buffer.from(digits))) return step;
  }
  return null;
}

/** The link an authenticator app reads from the QR code. */
export function otpauthUrl(issuer: string, account: string, secret: string): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=${STEP_SECONDS}`;
}

/** The key in groups of four, easier to type into an app by hand. */
export const groupKey = (secret: string) => secret.match(/.{1,4}/g)?.join(" ") ?? secret;
