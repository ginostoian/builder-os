import "server-only";
import { toCsv, type ExportTable } from "@/db/export";
import { zip } from "./zip";

/** A ZIP of one JSON file with everything, plus a CSV per table, and a short read-me. */
export function exportZip(title: string, tables: ExportTable[], now = new Date()): Uint8Array {
  const readme = [
    title,
    `Exported ${now.toISOString()} from Builder OS.`,
    "",
    "data.json holds every table below. The csv folder has the same tables, one file each, for spreadsheets.",
    "Files (photos, documents, receipts) are listed by their storage key; download them from the app.",
    "Sign-in codes, sessions and any token or secret are left out.",
    "",
    ...tables.map((t) => `${t.name}: ${t.rows.length} row${t.rows.length === 1 ? "" : "s"}`),
    "",
  ].join("\r\n");
  const json = JSON.stringify(Object.fromEntries(tables.map((t) => [t.name, t.rows])), null, 2);
  return zip([{ name: "README.txt", data: readme }, { name: "data.json", data: json }, ...tables.map((t) => ({ name: `csv/${t.name}.csv`, data: toCsv(t) }))], now);
}

export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "export";

export function zipResponse(body: Uint8Array, filename: string): Response {
  return new Response(body as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
