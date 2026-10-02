/**
 * Service library forms → validated `ServiceInput` / `BundleInput`, and the bundle price rule. Like the other
 * form parsers, these read only known field names, so extra fields (a smuggled `orgId`, `kind`, `ratePence`
 * on a bundle) are ignored rather than trusted.
 */
import { MAX_MARKUP_BPS, MAX_RATE_PENCE } from "./limits";
import { parsePence, parsePercentToBps, type Pence } from "./money";
import { lineCost } from "./quote";
import { bundleInput, serviceInput, type BundleInput, type ServiceInput } from "./schemas";

export type ServiceField = "category" | "name" | "description" | "unit" | "rate" | "markup" | "items";
export type ServiceErrors = Partial<Record<ServiceField, string>>;
export type ParseResult<T> = { ok: true; value: T } | { ok: false; errors: ServiceErrors };

/** Category suggestions for a new library. Companies can type their own. */
export const DEFAULT_CATEGORIES = [
  "Groundworks",
  "Structural",
  "Kitchens",
  "Bathrooms",
  "Electrical",
  "Plumbing & heating",
  "Plastering",
  "Decorating",
  "Flooring",
  "Joinery",
  "Roofing",
] as const;

export const UNIT_SUGGESTIONS = ["m²", "m", "m³", "item", "each", "point", "job", "day", "hour"] as const;

const text = (form: FormData, name: string): string | undefined => {
  const value = form.get(name);
  if (typeof value !== "string") return undefined;
  return value.trim() === "" ? undefined : value;
};

/** Blank markup means "use the company default", stored as null. */
function parseMarkup(form: FormData, errors: ServiceErrors): number | undefined {
  const raw = text(form, "markup");
  if (raw === undefined) return undefined;
  const bps = parsePercentToBps(raw, MAX_MARKUP_BPS);
  if (bps === null) errors.markup = `Enter a percentage between 0 and ${MAX_MARKUP_BPS / 100}, or leave it blank`;
  return bps ?? undefined;
}

export function parseServiceForm(form: FormData): ParseResult<ServiceInput> {
  const errors: ServiceErrors = {};
  const rateText = text(form, "rate");
  const rate = rateText === undefined ? null : parsePence(rateText);
  if (rate === null || rate < 0) errors.rate = "Enter a rate in pounds, e.g. 14.50";
  const markup = parseMarkup(form, errors);

  const parsed = serviceInput.safeParse({
    category: text(form, "category") ?? "",
    name: text(form, "name") ?? "",
    description: text(form, "description"),
    unit: text(form, "unit") ?? "",
    ratePence: rate !== null && rate >= 0 ? rate : 0,
    defaultMarkupBps: markup,
    kind: "service",
  });
  collect(parsed.success ? [] : parsed.error.issues, errors);
  if (Object.keys(errors).length > 0 || !parsed.success) return { ok: false, errors };
  return { ok: true, value: parsed.data };
}

export function parseBundleForm(form: FormData): ParseResult<BundleInput> {
  const errors: ServiceErrors = {};
  const markup = parseMarkup(form, errors);

  const ids = form.getAll("itemServiceId");
  const qtys = form.getAll("itemQty");
  const items: { serviceId: string; qty: number }[] = [];
  ids.forEach((serviceId, i) => {
    const q = typeof qtys[i] === "string" ? (qtys[i] as string).trim() : "";
    const n = /^\d+(\.\d+)?$/.test(q) ? Number(q) : Number.NaN;
    if (typeof serviceId !== "string" || serviceId === "") return; // an empty picker row
    if (Number.isNaN(n)) errors.items ??= "Enter a quantity for each service, e.g. 1 or 2.5";
    items.push({ serviceId, qty: Number.isNaN(n) ? 0 : n });
  });

  const parsed = bundleInput.safeParse({
    category: text(form, "category") ?? "",
    name: text(form, "name") ?? "",
    description: text(form, "description"),
    unit: text(form, "unit") ?? "",
    defaultMarkupBps: markup,
    items,
  });
  collect(parsed.success ? [] : parsed.error.issues, errors);
  if (Object.keys(errors).length > 0 || !parsed.success) return { ok: false, errors };
  return { ok: true, value: parsed.data };
}

function collect(issues: { path: PropertyKey[]; code: string; message: string }[], errors: ServiceErrors) {
  for (const issue of issues) {
    const top = issue.path[0];
    const field: ServiceField | undefined =
      top === "ratePence" ? "rate" : top === "defaultMarkupBps" ? "markup" : top === "items" ? "items" : (top as ServiceField | undefined);
    if (field && !errors[field]) errors[field] = friendly(field, issue);
  }
}

function friendly(field: ServiceField, issue: { path: PropertyKey[]; code: string; message: string }): string {
  if (issue.code === "too_small" && issue.path.length === 1) {
    if (field === "name") return "Enter a name";
    if (field === "category") return "Choose or type a category";
    if (field === "unit") return "Enter a unit, e.g. m² or job";
  }
  if (field === "items") {
    if (issue.path.length > 2 && issue.path[2] === "qty") return issue.code === "too_big" ? "That quantity is too large" : "Each quantity must be more than 0, with at most 3 decimals";
    if (issue.path.length > 2) return "Pick a service for each row";
  }
  return issue.message;
}

/**
 * A bundle's price: the sum of its items, each rounded to the penny like a quote line's cost (`lineCost`).
 * The database recomputes the same sum when an item's rate changes (src/db/services.ts).
 */
export function bundleRate(items: { qty: number; ratePence: Pence }[]): Pence {
  return items.reduce((sum, i) => sum + lineCost({ qty: i.qty, rate: i.ratePence }), 0);
}

export const bundleRateTooHigh = (pence: Pence) => pence > MAX_RATE_PENCE;

/** "Plaster skim" and "plaster skim " are the same category: compare trimmed and case-insensitively. */
export const sameCategory = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
