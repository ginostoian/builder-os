/**
 * Storing a receipt or bill: a photo (already shrunk in the browser) or a PDF, up to 4 MB. The type comes
 * from the bytes, never the file name. Used by the office screens and the site app.
 */
import "server-only";
import { MAX_FILE_BYTES, orgFileKey, sniffDocument } from "@/core/files";
import { putObject, randomName, storageConfigured } from "./storage";

export type StoredReceipt = { ok: true; key: string; contentType: string } | { ok: false; message: string };

export async function storeReceipt(orgId: string, file: FormDataEntryValue | null): Promise<StoredReceipt> {
  if (!storageConfigured()) return { ok: false, message: "File storage isn't set up yet, so receipts can't be added." };
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Choose a photo or PDF of the receipt." };
  if (file.size > MAX_FILE_BYTES) return { ok: false, message: "That file is over 4 MB. Take a photo instead, or compress the PDF." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffDocument(bytes);
  if (!type) return { ok: false, message: "Use a photo (JPEG, PNG or WebP) or a PDF." };
  const key = orgFileKey(orgId, "receipts", randomName(), type.ext);
  const stored = await putObject(key, bytes, type.mime);
  return stored.ok ? { ok: true, key, contentType: type.mime } : { ok: false, message: stored.message };
}
