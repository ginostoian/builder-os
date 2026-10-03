/**
 * File storage on Bunny.net (Edge Storage + a pull zone CDN). Optional: without the BUNNY_* settings uploads
 * are switched off and the app falls back to links (e.g. a logo URL).
 *
 *   BUNNY_STORAGE_ZONE     storage zone name
 *   BUNNY_STORAGE_KEY      the zone's password (FTP & API access), server-only
 *   BUNNY_STORAGE_HOST     region endpoint, e.g. uk.storage.bunnycdn.com (default storage.bunnycdn.com)
 *   BUNNY_CDN_URL          the pull zone in front of the storage zone, e.g. https://builderos.b-cdn.net
 *   BUNNY_TOKEN_KEY        optional: the pull zone's URL token authentication key, for private files
 *
 * Public files (logos) are served straight from the CDN. Private files (client documents, photos) need
 * token authentication enabled on a pull zone and are only handed out as short-lived signed URLs.
 */
import "server-only";
import { createHash, randomBytes } from "node:crypto";

/** Set up, and the CDN is https (logo URLs must be: the database checks it). */
export const storageConfigured = () =>
  Boolean(process.env.BUNNY_STORAGE_ZONE && process.env.BUNNY_STORAGE_KEY && process.env.BUNNY_CDN_URL?.startsWith("https://"));

const host = () => process.env.BUNNY_STORAGE_HOST || "storage.bunnycdn.com";
const cdnBase = () => (process.env.BUNNY_CDN_URL ?? "").replace(/\/+$/, "");
const objectUrl = (key: string) => `https://${host()}/${encodeURIComponent(process.env.BUNNY_STORAGE_ZONE!)}/${key.split("/").map(encodeURIComponent).join("/")}`;

/** Unguessable file name part for storage keys. */
export const randomName = () => randomBytes(18).toString("base64url");

export type StorageResult = { ok: true } | { ok: false; message: string };

export async function putObject(key: string, body: Uint8Array, contentType: string): Promise<StorageResult> {
  if (!storageConfigured()) return { ok: false, message: "File storage isn't set up yet." };
  try {
    const res = await fetch(objectUrl(key), {
      method: "PUT",
      headers: { AccessKey: process.env.BUNNY_STORAGE_KEY!, "Content-Type": contentType, Checksum: createHash("sha256").update(body).digest("hex").toUpperCase() },
      body: Buffer.from(body),
      signal: AbortSignal.timeout(20_000),
    });
    if (res.ok) return { ok: true };
    console.error("Bunny upload refused", res.status);
    return { ok: false, message: "The file couldn't be stored. Try again in a moment." };
  } catch {
    return { ok: false, message: "The file couldn't be stored. Try again in a moment." };
  }
}

export async function deleteObject(key: string): Promise<void> {
  if (!storageConfigured()) return;
  try {
    const res = await fetch(objectUrl(key), { method: "DELETE", headers: { AccessKey: process.env.BUNNY_STORAGE_KEY! }, signal: AbortSignal.timeout(10_000) });
    if (!res.ok && res.status !== 404) console.error("Bunny delete refused", res.status);
  } catch {
    // An orphaned file costs pennies; never fail the user's action over it.
  }
}

export const publicUrl = (key: string) => `${cdnBase()}/${key}`;
export const cdnBaseUrl = () => cdnBase() || undefined;

/**
 * A URL that works until `expiresInSeconds` from now, using Bunny's URL token authentication:
 * token = base64url(sha256(tokenKey + path + expires)). Requires BUNNY_TOKEN_KEY.
 */
export function signedUrl(key: string, expiresInSeconds = 3_600, now = Date.now()): string {
  const tokenKey = process.env.BUNNY_TOKEN_KEY;
  if (!tokenKey) throw new Error("BUNNY_TOKEN_KEY is not set");
  const path = `/${key}`;
  const expires = Math.floor(now / 1000) + expiresInSeconds;
  const token = createHash("sha256").update(tokenKey + path + expires).digest("base64url");
  return `${cdnBase()}${path}?token=${token}&expires=${expires}`;
}
