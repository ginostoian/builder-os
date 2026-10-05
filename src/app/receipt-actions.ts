"use server";

import { allow } from "@/server/rate-limit";
import { hasFeature } from "@/server/plan";
import { getSession } from "@/auth/session";
import { can } from "@/core/roles";
import { readReceipt, receiptReaderConfigured, type ReceiptReading } from "@/server/receipt-reader";

/** Receipt reading for the office's expense form and the site app. Anyone who can log a receipt. */

export async function receiptReaderOnAction(): Promise<boolean> {
  const s = await getSession();
  return can(s.role, "site.app") && receiptReaderConfigured() && ((await hasFeature("costs")) || (await hasFeature("site_app")));
}

export async function readReceiptAction(form: FormData): Promise<ReceiptReading | null> {
  const s = await getSession();
  if (!can(s.role, "site.app")) return null;
  // Receipts belong to job costs and the site app, both Pro.
  if (!(await hasFeature("costs")) && !(await hasFeature("site_app"))) return null;
  // Each reading is a paid API call: a generous daily allowance per person.
  if (!(await allow({ bucket: "receipt_read", subject: s.memberId, max: 200, windowSeconds: 86_400 }))) return null;
  return readReceipt(form.get("file"));
}
