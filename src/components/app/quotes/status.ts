import type { BadgeTone } from "@/components/ui/badge";

/** How each quote status reads in lists and headers. */
export const QUOTE_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  draft: { label: "Draft", tone: "grey" },
  sent: { label: "Sent", tone: "blue" },
  viewed: { label: "Viewed", tone: "amber" },
  accepted: { label: "Accepted", tone: "green" },
  declined: { label: "Declined", tone: "red" },
  expired: { label: "Expired", tone: "muted" },
};
