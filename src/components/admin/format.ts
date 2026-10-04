/** Formatting shared by the admin pages (UK dates and money). */
import { formatGBP } from "@/core/money";
import type { CompanyBucket } from "@/core/metrics";

const tz = { timeZone: "Europe/London" } as const;
export const dayMonth = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
export const monthName = (iso: string) => new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
export const monthYear = (iso: string) => new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
export const date = (d: Date) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", ...tz }).format(d);
export const pct = (v: number | null, digits = 1) => (v === null ? "–" : `${(v * 100).toFixed(digits)}%`);
export const num = (v: number, digits = 0) => v.toLocaleString("en-GB", { maximumFractionDigits: digits, minimumFractionDigits: digits });
export const gbp = (pence: number) => formatGBP(Math.round(pence), 0);

export function ago(d: Date | null, now: Date) {
  if (!d) return "Never";
  const mins = Math.round((now.getTime() - d.getTime()) / 60_000);
  if (mins < 60) return mins <= 1 ? "Just now" : `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days < 60 ? `${days}d ago` : date(d);
}

export const BUCKET_STYLE: Record<CompanyBucket, string> = {
  paying: "bg-success",
  past_due: "bg-danger",
  trial: "bg-brand",
  comped: "bg-info",
  free: "bg-faint",
};
