/**
 * File rules shared by uploads: what we accept, how we check it really is that type, and how storage keys
 * are built. Pure, so it's tested without storage.
 */

export type ImageType = { mime: "image/png" | "image/jpeg" | "image/webp"; ext: "png" | "jpg" | "webp" };
export type DocumentType = ImageType | { mime: "application/pdf"; ext: "pdf" };

/**
 * Largest project file (drawings, certificates). Vercel caps a request at 4.5 MB, so this is the most a
 * single upload can carry; bigger PDFs need compressing first.
 */
export const MAX_FILE_BYTES = 4_000_000;

/** Largest logo we take. Logos are shown small; this is plenty for a sharp one. */
export const MAX_LOGO_BYTES = 1_000_000;

/** Largest site photo we take. The browser shrinks photos to about 2,000 px first, which lands well under this. */
export const MAX_PHOTO_BYTES = 1_800_000;

/**
 * The real type of an image from its first bytes, ignoring the name and the browser's claimed type. SVG is
 * deliberately not accepted: it can carry scripts, and logos are served from a public CDN.
 */
export function sniffImage(bytes: Uint8Array): ImageType | null {
  const b = bytes;
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) {
    return { mime: "image/png", ext: "png" };
  }
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (b.length >= 12 && String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP") return { mime: "image/webp", ext: "webp" };
  return null;
}

/** A project document: a PDF or one of the image types, judged by its bytes. */
export function sniffDocument(bytes: Uint8Array): DocumentType | null {
  if (bytes.length >= 5 && String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-") return { mime: "application/pdf", ext: "pdf" };
  return sniffImage(bytes);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Storage key for a company file: `orgs/{orgId}/{area}/{random}.{ext}`. The random part makes keys
 * unguessable and never reused, so a new logo is a new URL (no stale CDN cache).
 */
export function orgFileKey(orgId: string, area: "logo" | "files" | "photos", random: string, ext: string): string {
  if (!UUID.test(orgId)) throw new Error("Invalid org id");
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(random) || !/^[a-z0-9]{2,5}$/.test(ext)) throw new Error("Invalid file key part");
  return `orgs/${orgId}/${area}/${random}.${ext}`;
}

/** The storage key behind one of our public CDN URLs, if it is one for this company. */
export function keyFromCdnUrl(url: string | null, cdnBase: string | undefined, orgId: string): string | null {
  if (!url || !cdnBase) return null;
  const base = cdnBase.replace(/\/+$/, "") + "/";
  if (!url.startsWith(base)) return null;
  const key = url.slice(base.length);
  return key.startsWith(`orgs/${orgId}/`) && !key.includes("..") ? key : null;
}
