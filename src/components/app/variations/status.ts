import type { BadgeTone } from "@/components/ui/badge";

/** How each variation status reads in lists and headers. */
export const VARIATION_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  draft: { label: "Draft", tone: "grey" },
  sent: { label: "Awaiting approval", tone: "amber" },
  approved: { label: "Approved", tone: "green" },
  rejected: { label: "Rejected", tone: "red" },
  withdrawn: { label: "Withdrawn", tone: "muted" },
};
