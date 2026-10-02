/**
 * Service library CSV import: header matching, row validation and duplicate detection. Pure, so the same
 * code previews the file in the browser's round trip and validates it again on the server before writing.
 */
import { parseCsv } from "./csv";
import { MAX_MARKUP_BPS } from "./limits";
import { parsePence, parsePercentToBps } from "./money";
import { serviceInput, type ServiceInput } from "./schemas";

export const MAX_IMPORT_ROWS = 1_000;
export const MAX_IMPORT_BYTES = 1_000_000;

export const IMPORT_COLUMNS = ["category", "name", "unit", "rate", "description", "markup"] as const;
type Column = (typeof IMPORT_COLUMNS)[number];
const REQUIRED: Column[] = ["category", "name", "unit", "rate"];

/** Header names people actually use, lower-cased with spaces and punctuation removed. */
const ALIASES: Record<string, Column> = {
  category: "category", trade: "category", section: "category", group: "category",
  name: "name", service: "name", item: "name", title: "name",
  unit: "unit", units: "unit", uom: "unit", per: "unit",
  rate: "rate", price: "rate", cost: "rate", unitrate: "rate", rateexvat: "rate", priceexvat: "rate", unitprice: "rate",
  description: "description", details: "description", notes: "description", spec: "description",
  markup: "markup", markuppercent: "markup",
};
const normalise = (h: string) => h.toLowerCase().replace(/[^a-z]/g, "");

export type ImportRow =
  | { line: number; status: "new"; value: ServiceInput }
  | { line: number; status: "duplicate"; value: ServiceInput }
  | { line: number; status: "error"; name: string; errors: string[] };

export type ImportPlan =
  | { ok: false; error: string }
  | { ok: true; rows: ImportRow[]; counts: { new: number; duplicate: number; error: number }; ignoredColumns: string[] };

/** Same category and name, ignoring case and surrounding spaces. */
export const duplicateKey = (category: string, name: string) => `${category.trim().toLowerCase()}\u0000${name.trim().toLowerCase()}`;

/**
 * Read a CSV into an import plan. `existing` holds `duplicateKey`s already in the library; rows matching one
 * (or an earlier row in the same file) are reported as duplicates and skipped on import.
 */
export function planImport(text: string, existing: ReadonlySet<string>): ImportPlan {
  if (text.length > MAX_IMPORT_BYTES) return { ok: false, error: "The file is over 1 MB. Split it into smaller files." };
  const csv = parseCsv(text, { maxRows: MAX_IMPORT_ROWS + 1 });
  if (!csv.ok) return csv;
  const [header, ...body] = csv.rows;
  if (!header) return { ok: false, error: "The file is empty." };

  const columns = new Map<Column, number>();
  const ignoredColumns: string[] = [];
  header.forEach((h, i) => {
    const col = ALIASES[normalise(h)];
    if (col && !columns.has(col)) columns.set(col, i);
    else if (h.trim()) ignoredColumns.push(h.trim());
  });
  const missing = REQUIRED.filter((c) => !columns.has(c));
  if (missing.length > 0) {
    return { ok: false, error: `The first row must name the columns. Missing: ${missing.join(", ")}. Download the template to see the layout.` };
  }
  if (body.length === 0) return { ok: false, error: "The file has headings but no services." };
  if (body.length > MAX_IMPORT_ROWS) return { ok: false, error: `Import up to ${MAX_IMPORT_ROWS.toLocaleString("en-GB")} services at a time.` };

  const seen = new Set(existing);
  const rows: ImportRow[] = body.map((cells, i) => {
    const line = i + 2; // 1-based, after the header
    const get = (c: Column) => {
      const idx = columns.get(c);
      const v = idx === undefined ? "" : (cells[idx] ?? "").trim();
      return v === "" ? undefined : v;
    };
    const errors: string[] = [];
    const rateText = get("rate");
    const rate = rateText === undefined ? null : parsePence(rateText);
    if (rate === null || rate < 0) errors.push(rateText === undefined ? "Rate is missing" : `Rate "${rateText}" isn't an amount in pounds`);
    const markupText = get("markup");
    const markup = markupText === undefined ? undefined : parsePercentToBps(markupText, MAX_MARKUP_BPS);
    if (markup === null) errors.push(`Markup "${markupText}" isn't a percentage between 0 and ${MAX_MARKUP_BPS / 100}`);

    const parsed = serviceInput.safeParse({
      category: get("category") ?? "",
      name: get("name") ?? "",
      unit: get("unit") ?? "",
      description: get("description"),
      ratePence: rate !== null && rate >= 0 ? rate : 0,
      defaultMarkupBps: markup ?? undefined,
      kind: "service",
    });
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = String(issue.path[0]);
        const label = field === "ratePence" ? "Rate" : field === "description" ? "Description" : field[0].toUpperCase() + field.slice(1);
        errors.push(issue.code === "too_small" ? `${label} is missing` : issue.code === "too_big" ? `${label} is too long` : `${label}: ${issue.message}`);
      }
    }
    if (errors.length > 0 || !parsed.success) return { line, status: "error", name: get("name") ?? "", errors };

    const key = duplicateKey(parsed.data.category, parsed.data.name);
    if (seen.has(key)) return { line, status: "duplicate", value: parsed.data };
    seen.add(key);
    return { line, status: "new", value: parsed.data };
  });

  const counts = { new: 0, duplicate: 0, error: 0 };
  for (const r of rows) counts[r.status]++;
  return { ok: true, rows, counts, ignoredColumns };
}

/** The downloadable template: headings plus two example rows. */
export const IMPORT_TEMPLATE = [
  "category,name,unit,rate,description,markup",
  'Plastering,"Skim plaster, walls",m²,22.00,"Bead, scrim and two-coat skim to existing walls.",',
  "Electrical,Double socket (new point),point,120,Chased in and tested.,15",
  "",
].join("\r\n");
