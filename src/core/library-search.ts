/**
 * Searching the service library while building a quote or a variation, and turning a pick into lines.
 * Pure, so the quote builder and the variation editor behave the same.
 */

export type LibraryPickOption = {
  id: string;
  kind: "service" | "bundle";
  category: string;
  name: string;
  description: string | null;
  unit: string;
  ratePence: number;
  defaultMarkupBps: number | null;
  items: { serviceId: string; qty: number; name: string; unit: string; ratePence: number; defaultMarkupBps: number | null }[];
};

/** Match every word of the query against name, category and description; names that start with it first. */
export function searchLibrary<T extends LibraryPickOption>(library: T[], query: string, limit = 8): T[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const hits = library.filter((s) => {
    const hay = `${s.name} ${s.category} ${s.description ?? ""}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
  const q = query.trim().toLowerCase();
  return hits.sort((a, b) => Number(b.name.toLowerCase().startsWith(q)) - Number(a.name.toLowerCase().startsWith(q))).slice(0, limit);
}

/** The priced lines a pick adds: one for a service, one per service for a bundle (at the bundle's quantities). */
export function pickLines(option: LibraryPickOption, fallbackMarkupBps: number) {
  if (option.kind === "bundle") {
    return option.items.map((i) => ({ serviceId: i.serviceId, name: i.name, qty: i.qty, unit: i.unit, ratePence: i.ratePence, markupBps: i.defaultMarkupBps ?? fallbackMarkupBps, description: null as string | null }));
  }
  return [{ serviceId: option.id, name: option.name, qty: 1, unit: option.unit, ratePence: option.ratePence, markupBps: option.defaultMarkupBps ?? fallbackMarkupBps, description: option.description }];
}
