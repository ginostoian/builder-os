/**
 * Client form → validated `ClientInput`. Reads only the known field names, so extra form fields (including
 * Next's own `$ACTION_*` keys, or a smuggled `orgId`) are ignored rather than trusted.
 */
import { clientInput, type Address, type ClientInput } from "./schemas";

export type ClientField = "name" | "email" | "phone" | "line1" | "line2" | "town" | "postcode" | "source" | "notes";
export type ClientErrors = Partial<Record<ClientField, string>>;
export type ClientParseResult = { ok: true; value: ClientInput } | { ok: false; errors: ClientErrors };

/** Suggestions for "How did they find you?". Free text is allowed too. */
export const CLIENT_SOURCES = ["Referral", "Website", "Checkatrade", "MyBuilder", "Rated People", "Repeat client", "Social media", "Drive-by"] as const;

const ADDRESS_FIELDS = ["line1", "line2", "town", "postcode"] as const;

const text = (form: FormData, name: string): string | undefined => {
  const value = form.get(name);
  if (typeof value !== "string") return undefined;
  return value.trim() === "" ? undefined : value;
};

export function parseClientForm(form: FormData): ClientParseResult {
  // The address is optional, but a half-filled one is a mistake: ask for the missing parts.
  const parts = Object.fromEntries(ADDRESS_FIELDS.map((f) => [f, text(form, f)])) as Record<(typeof ADDRESS_FIELDS)[number], string | undefined>;
  const hasAddress = ADDRESS_FIELDS.some((f) => parts[f] !== undefined);
  const address = hasAddress ? { line1: parts.line1 ?? "", line2: parts.line2, town: parts.town ?? "", postcode: parts.postcode ?? "" } : undefined;

  const parsed = clientInput.safeParse({
    name: text(form, "name") ?? "",
    email: text(form, "email"),
    phone: text(form, "phone"),
    address,
    source: text(form, "source"),
    notes: text(form, "notes"),
  });
  if (parsed.success) return { ok: true, value: parsed.data };

  const errors: ClientErrors = {};
  for (const issue of parsed.error.issues) {
    const [top, sub] = issue.path;
    const field = (top === "address" ? sub : top) as ClientField | undefined;
    if (field && !errors[field]) errors[field] = friendly(field, issue.code, issue.message);
  }
  return { ok: false, errors };
}

function friendly(field: ClientField, code: string, message: string): string {
  switch (field) {
    case "name":
      return code === "too_small" ? "Enter the client's name" : message;
    case "email":
      return "Enter an email address like name@example.com";
    case "line1":
      return code === "too_small" ? "Enter the first line of the address" : message;
    case "town":
      return code === "too_small" ? "Enter the town or city" : message;
    case "postcode":
      return "Enter a UK postcode, e.g. SW1A 1AA";
    default:
      return message;
  }
}

/** One-line address for lists, e.g. "14 Elm Road, Bristol BS7 8AA". */
export function formatAddress(address: Address | null | undefined): string {
  if (!address) return "";
  return [address.line1, address.line2, [address.town, address.postcode].filter(Boolean).join(" ")].filter(Boolean).join(", ");
}

/**
 * Escape `%`, `_` and `\` so a search for "50%" matches literally in an ILIKE pattern. Postgres's default
 * LIKE escape character is backslash.
 */
export function likePattern(search: string): string {
  return `%${search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}
