/**
 * Company settings form → validated `OrgSettingsInput`. Reads only the known field names, so extra form
 * fields (including Next's own `$ACTION_*` keys) are ignored rather than trusted.
 */
import { MAX_MARKUP_BPS, MAX_VAT_BPS } from "./limits";
import { parsePercentToBps } from "./money";
import { orgSettingsInput, type OrgSettingsInput } from "./schemas";

export type SettingsField = keyof OrgSettingsInput;
export type SettingsErrors = Partial<Record<SettingsField, string>>;
export type SettingsParseResult = { ok: true; value: OrgSettingsInput } | { ok: false; errors: SettingsErrors };

/** UK VAT rates offered in the form (standard, reduced, zero), as basis points. */
export const VAT_RATE_OPTIONS = [2000, 500, 0] as const;

const text = (form: FormData, name: string): string | undefined => {
  const value = form.get(name);
  if (typeof value !== "string") return undefined;
  return value.trim() === "" ? undefined : value;
};

export function parseCompanySettingsForm(form: FormData): SettingsParseResult {
  const errors: SettingsErrors = {};

  const markup = parsePercentToBps(text(form, "defaultMarkup") ?? "0", MAX_MARKUP_BPS);
  if (markup === null) errors.defaultMarkupBps = `Enter a percentage between 0 and ${MAX_MARKUP_BPS / 100}, e.g. 15`;
  const vat = parsePercentToBps(text(form, "defaultVatRate") ?? "", MAX_VAT_BPS);
  if (vat === null) errors.defaultVatRateBps = "Choose a VAT rate";

  const parsed = orgSettingsInput.safeParse({
    name: text(form, "name") ?? "",
    tradingName: text(form, "tradingName"),
    vatNumber: text(form, "vatNumber"),
    logoUrl: text(form, "logoUrl"),
    brandColour: text(form, "brandColour"),
    defaultMarkupBps: markup ?? 0,
    defaultVatRateBps: vat ?? 0,
    quoteTerms: text(form, "quoteTerms"),
  });

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as SettingsField | undefined;
      if (field && !errors[field]) errors[field] = friendly(field, issue.code, issue.message);
    }
  }
  if (Object.keys(errors).length > 0 || !parsed.success) return { ok: false, errors };
  return { ok: true, value: parsed.data };
}

function friendly(field: SettingsField, code: string, message: string): string {
  switch (field) {
    case "name":
      return code === "too_small" ? "Enter your company name" : message;
    case "logoUrl":
      return "Enter a link starting with https://";
    case "brandColour":
      return "Use a hex colour like #E8590C";
    default:
      return message;
  }
}
