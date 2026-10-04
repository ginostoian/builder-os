"use server";

import { getSession } from "@/auth/session";
import { can } from "@/core/roles";
import { readReceipt, receiptReaderConfigured, type ReceiptReading } from "@/server/receipt-reader";

/** Receipt reading for the office's expense form and the site app. Anyone who can log a receipt. */

export async function receiptReaderOnAction(): Promise<boolean> {
  const s = await getSession();
  return can(s.role, "site.app") && receiptReaderConfigured();
}

export async function readReceiptAction(form: FormData): Promise<ReceiptReading | null> {
  const s = await getSession();
  if (!can(s.role, "site.app")) return null;
  return readReceipt(form.get("file"));
}
