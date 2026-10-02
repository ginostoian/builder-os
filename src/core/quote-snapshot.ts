/**
 * What a client is sent: a frozen, client-safe copy of the quote. It holds selling prices only (never cost
 * rates or markups) and only the notes marked "show to client". The portal and any future PDF render from
 * this, never from the live draft, so what a client signs is exactly what they were sent.
 */
import type { Address } from "./schemas";
import { lineTotal, quoteRef, quoteTotals, sellRate } from "./quote";

export type SnapshotLine = { id: string; name: string; qty: number; unit: string; unitPrice: number; total: number; note: string | null; kind: string };
export type SnapshotSection = { id: string; name: string; total: number; lines: SnapshotLine[] };

export type QuoteSnapshot = {
  v: 1;
  company: { name: string; tradingName: string | null; vatNumber: string | null; logoUrl: string | null; brandColour: string | null; terms: string | null };
  client: { name: string };
  quote: { number: number; ref: string; title: string; siteAddress: Address | null; validUntil: string | null; vatRateBps: number; versionNo: number };
  sections: SnapshotSection[];
  totals: { net: number; vat: number; total: number };
};

export type SnapshotInput = {
  company: QuoteSnapshot["company"];
  clientName: string;
  quote: { number: number; title: string; siteAddress: Address | null; validUntil: string | null; vatRateBps: number };
  versionNo: number;
  sections: {
    id: string;
    name: string;
    lines: { id: string; name: string; qty: number; unit: string; ratePence: number; markupBps: number; note: string | null; noteVisible: boolean; kind: string }[];
  }[];
};

export function buildSnapshot(input: SnapshotInput): QuoteSnapshot {
  const sections = input.sections.map((s) => {
    const lines = s.lines.map((l) => {
      const priced = { qty: l.qty, rate: l.ratePence, markup: l.markupBps };
      return {
        id: l.id,
        name: l.name,
        qty: l.qty,
        unit: l.unit,
        unitPrice: sellRate(priced),
        total: lineTotal(priced),
        note: l.noteVisible && l.note ? l.note : null,
        kind: l.kind,
      };
    });
    return { id: s.id, name: s.name, total: lines.reduce((sum, l) => sum + l.total, 0), lines };
  });
  const totals = quoteTotals(
    input.sections.map((s) => ({ id: s.id, name: s.name, lines: s.lines.map((l) => ({ id: l.id, name: l.name, unit: l.unit, qty: l.qty, rate: l.ratePence, markup: l.markupBps })) })),
    input.quote.vatRateBps,
  );
  return {
    v: 1,
    company: input.company,
    client: { name: input.clientName },
    quote: { ...input.quote, ref: quoteRef(input.quote.number), versionNo: input.versionNo },
    sections,
    totals: { net: totals.net, vat: totals.vat, total: totals.total },
  };
}

/** JSON with object keys sorted, so the same snapshot always hashes the same. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .filter((k) => (value as Record<string, unknown>)[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${canonicalJson((value as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

/** True once the valid-until date has passed, in UK time. A quote is valid through the whole of that day. */
export function isExpired(validUntil: string | null, now = new Date()): boolean {
  if (!validUntil) return false;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(now); // YYYY-MM-DD
  return today > validUntil;
}

/** "31 January 2027" in UK time. Accepts a date-only string ("2027-01-31") or a timestamp. */
export const longDate = (d: string | Date) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" }).format(typeof d === "string" ? new Date(`${d}T12:00:00Z`) : d);
