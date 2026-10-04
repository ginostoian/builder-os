import type { Feature } from "@/core/plans";
import type { AdminScreen } from "../routes";

/** Which plan feature each office screen needs (screens not listed are on every plan). */
export const SCREEN_FEATURE: Partial<Record<AdminScreen, Feature>> = {
  board: "projects",
  variations: "variations",
  invoices: "invoicing",
  people: "team",
  purchases: "costs",
  reports: "reports",
  pipeline: "pipeline",
  calendar: "calendar",
};
