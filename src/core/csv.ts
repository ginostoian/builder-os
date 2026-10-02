/**
 * A small RFC 4180 CSV reader: quoted fields, "" escapes, newlines inside quotes, CRLF, a UTF-8 BOM, and
 * comma, semicolon or tab separators (Excel in some locales saves with semicolons).
 */

export type CsvResult = { ok: true; rows: string[][] } | { ok: false; error: string };

/** Pick the separator that appears most in the header line, outside quotes. */
function detectSeparator(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const counts = { ",": 0, ";": 0, "\t": 0 };
  let quoted = false;
  for (const ch of firstLine) {
    if (ch === '"') quoted = !quoted;
    else if (!quoted && ch in counts) counts[ch as keyof typeof counts]++;
  }
  const [best, n] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return n > 0 ? best : ",";
}

export function parseCsv(input: string, { maxRows = 5_000 }: { maxRows?: number } = {}): CsvResult {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const sep = detectSeparator(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let i = 0;

  const endField = () => {
    row.push(field);
    field = "";
  };
  const endRow = () => {
    endField();
    // Skip blank lines (a single empty field), common at the end of exported files.
    if (!(row.length === 1 && row[0].trim() === "")) rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
      } else {
        field += ch;
      }
      i++;
      continue;
    }
    if (ch === '"' && field.trim() === "") {
      field = "";
      quoted = true;
    } else if (ch === sep) {
      endField();
    } else if (ch === "\n" || ch === "\r") {
      endRow();
      if (ch === "\r" && text[i + 1] === "\n") i++;
      if (rows.length > maxRows) return { ok: false, error: `The file has more than ${maxRows.toLocaleString("en-GB")} rows. Split it into smaller files.` };
    } else {
      field += ch;
    }
    i++;
  }
  if (quoted) return { ok: false, error: "The file has a quote (\") that is never closed. Check it saved as CSV." };
  if (field !== "" || row.length > 0) endRow();
  if (rows.length > maxRows) return { ok: false, error: `The file has more than ${maxRows.toLocaleString("en-GB")} rows. Split it into smaller files.` };
  return { ok: true, rows };
}

/** Quote a value for a CSV file we generate (the import template). */
export function csvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
