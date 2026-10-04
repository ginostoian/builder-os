import type { BadgeTone } from "@/components/ui/badge";
import type { LeadSource, LeadStage, LostReason } from "@/core/pipeline";
import type { Address } from "@/core/schemas";

export const STAGE_TONE: Record<LeadStage, BadgeTone> = { new: "brand", contacted: "blue", site_visit: "blue", quoting: "amber", quote_sent: "amber", won: "green", lost: "muted" };
export const STAGE_DOT: Record<LeadStage, string> = { new: "bg-brand", contacted: "bg-info", site_visit: "bg-info", quoting: "bg-warning", quote_sent: "bg-warning", won: "bg-success", lost: "bg-faint" };

/** A lead on the board or in the list. */
export type LeadCard = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  postcode: string | null;
  source: LeadSource;
  projectType: string | null;
  description: string | null;
  valuePence: number | null;
  stage: LeadStage;
  ownerName: string | null;
  nextActionOn: string | null;
  nextAction: string | null;
  visitAt: string | null;
  lostReason: LostReason | null;
  quoteNumber: number | null;
  quoteStatus: string | null;
  viaWebForm: boolean;
  createdAt: string;
  stageChangedAt: string;
};

/** The editable details of a lead. */
export type LeadValues = {
  name: string;
  email: string | null;
  phone: string | null;
  postcode: string | null;
  address: Address | null;
  source: LeadSource;
  sourceDetail: string | null;
  projectType: string | null;
  description: string | null;
  budget: string | null;
  valuePence: number | null;
  ownerMemberId: string | null;
};

export const EMPTY_LEAD: LeadValues = { name: "", email: null, phone: null, postcode: null, address: null, source: "referral", sourceDetail: null, projectType: null, description: null, budget: null, valuePence: null, ownerMemberId: null };

export type Owner = { id: string; name: string };

/** "2 days ago", "3 weeks ago". */
export function ago(iso: string, now = new Date()): string {
  const days = Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}
