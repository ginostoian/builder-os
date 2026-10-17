/**
 * Xero tokens are stored encrypted (AES-256-GCM). The key is XERO_TOKEN_KEY if set (64 hex characters),
 * otherwise one derived from the app secret. Changing either means connecting to Xero again.
 */
import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { appKey } from "../rate-limit";

function key(): Buffer {
  const own = process.env.XERO_TOKEN_KEY?.trim();
  if (own && /^[0-9a-f]{64}$/i.test(own)) return Buffer.from(own, "hex");
  return appKey("xero-tokens");
}

/** "v1.<iv>.<tag>.<ciphertext>", all base64url. */
export function sealToken(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), body.toString("base64url")].join(".");
}

/** The token, or null if it can't be read (tampered with, or the key changed). */
export function openToken(sealed: string): string | null {
  const [v, iv, tag, body] = sealed.split(".");
  if (v !== "v1" || !iv || !tag || !body) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(body, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
