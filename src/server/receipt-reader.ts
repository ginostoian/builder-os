/**
 * Reading a receipt photo or PDF with Claude: the shop, what was bought, the date, the total and the VAT,
 * so nobody types them in. Optional: only when ANTHROPIC_API_KEY is set. The reading only fills in the
 * form; the person checks it before saving, and nothing is stored here.
 */
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { EXPENSE_CATEGORIES, type ExpenseCategory } from "@/core/costs";
import { MAX_FILE_BYTES, sniffDocument } from "@/core/files";
import { parsePence } from "@/core/money";

export const receiptReaderConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY?.trim());

export type ReceiptReading = {
  supplier: string | null;
  description: string | null;
  /** YYYY-MM-DD */
  spentOn: string | null;
  totalPence: number | null;
  vatPence: number | null;
  category: ExpenseCategory | null;
};

const Reading = z.object({
  is_receipt: z.boolean().describe("False if this isn't a receipt, invoice or bill, or is unreadable."),
  supplier: z.string().nullable().describe("The shop or supplier's trading name, e.g. Screwfix, Travis Perkins."),
  description: z.string().nullable().describe("A short summary of what was bought, under 80 characters, e.g. 'Screws, silicone and 2 bags of plaster'."),
  date: z.string().nullable().describe("Purchase date as YYYY-MM-DD."),
  total: z.string().nullable().describe("The final amount paid including VAT, in pounds, digits only, e.g. '123.45'."),
  vat: z.string().nullable().describe("The VAT amount shown, in pounds, e.g. '20.58'. Null if no VAT is shown."),
  // A plain string (checked below), so one odd category never loses the whole reading.
  category: z.string().nullable().describe(`The best-fitting cost category, one of: ${EXPENSE_CATEGORIES.join(", ")}.`),
});

const SYSTEM = `You read receipts, invoices and bills for a UK building and renovation company so their costs can be logged against a job.
Read only what is printed. Never guess a number: if the total or VAT can't be read clearly, return null for it.
Amounts are in pounds sterling. Dates on UK receipts are day first (05/10/26 is 5 October 2026).
If several totals are shown, use the amount actually paid (after discounts, including VAT).`;

let client: Anthropic | null = null;

/** The reading, or null when it isn't set up, isn't a receipt, or couldn't be read. Never throws. */
export async function readReceipt(file: FormDataEntryValue | null): Promise<ReceiptReading | null> {
  if (!receiptReaderConfigured()) return null;
  if (!(file instanceof File) || file.size === 0 || file.size > MAX_FILE_BYTES) return null;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffDocument(bytes);
  if (!type) return null;
  const data = Buffer.from(bytes).toString("base64");
  const media: Anthropic.Beta.BetaContentBlockParam =
    type.mime === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data } }
      : { type: "image", source: { type: "base64", media_type: type.mime, data } };

  try {
    client ??= new Anthropic({ timeout: 45_000, maxRetries: 1 });
    const response = await client.beta.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 2000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM,
      output_config: { effort: "low", format: betaZodOutputFormat(Reading) },
      messages: [{ role: "user", content: [media, { type: "text", text: "Read this receipt." }] }],
    });
    const r = response.stop_reason === "refusal" ? null : response.parsed_output;
    if (!r || !r.is_receipt) return null;
    const total = r.total ? parsePence(r.total) : null;
    const vat = r.vat ? parsePence(r.vat) : null;
    return {
      supplier: r.supplier?.trim().slice(0, 120) || null,
      description: r.description?.trim().slice(0, 300) || null,
      spentOn: r.date && /^\d{4}-\d{2}-\d{2}$/.test(r.date) && !Number.isNaN(Date.parse(r.date)) ? r.date : null,
      totalPence: total && total > 0 ? total : null,
      vatPence: vat !== null && total !== null && vat <= total ? vat : null,
      category: (EXPENSE_CATEGORIES as readonly string[]).includes(r.category ?? "") ? (r.category as ExpenseCategory) : null,
    };
  } catch (error) {
    if (error instanceof Anthropic.APIError) console.error("Reading a receipt failed", error.status, error.message);
    else console.error("Reading a receipt failed", error instanceof Error ? error.message : error);
    return null;
  }
}
