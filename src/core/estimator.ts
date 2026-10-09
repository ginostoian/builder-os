/**
 * The project cost estimator: a homeowner picks a project, its size and finish, and gets a price range.
 * It runs on the public website (typical UK prices) and on builders' own websites, where each company
 * can offer only the work it does, set its area and adjust the prices to its own.
 *
 * Typical prices are mid-points of published 2026 UK ranges, before VAT, for a mid-priced area; regions
 * scale them. Money is whole pounds here (estimates, not invoices).
 */
import { z } from "zod";

export const PROJECT_TYPES = ["single_extension", "double_extension", "loft", "kitchen", "bathroom", "garage", "refurb"] as const;
export type ProjectType = (typeof PROJECT_TYPES)[number];

export const FINISHES = ["basic", "standard", "premium"] as const;
export type Finish = (typeof FINISHES)[number];

export const FINISH_LABEL: Record<Finish, { label: string; sub: string }> = {
  basic: { label: "Basic", sub: "Simple, good value" },
  standard: { label: "Standard", sub: "Mid-range" },
  premium: { label: "Premium", sub: "High-end finish" },
};

type Variant = { id: string; label: string; price: number };

export type ProjectSpec = {
  label: string;
  short: string;
  /** "area": price per m² × size; "variant": a fixed price for the chosen kind. */
  kind: "area" | "variant";
  /** Price per m² (area) at standard finish, or per variant. */
  price: number;
  sizeLabel?: string;
  defaultSize?: number;
  minSize?: number;
  maxSize?: number;
  variants?: Variant[];
  /** Finish multipliers. */
  finish: Record<Finish, number>;
  /** The range either side of the middle figure, as a fraction. */
  spread: number;
  /** Things not in the price that people often forget. */
  excludes: string;
};

export const PROJECTS: Record<ProjectType, ProjectSpec> = {
  single_extension: {
    label: "Single-storey extension",
    short: "Extension",
    kind: "area",
    price: 2300,
    sizeLabel: "Floor area",
    defaultSize: 20,
    minSize: 6,
    maxSize: 80,
    finish: { basic: 0.8, standard: 1, premium: 1.3 },
    spread: 0.12,
    excludes: "Architect, structural engineer, planning and building control fees (often 10% to 15% more), and the kitchen or bathroom fit-out.",
  },
  double_extension: {
    label: "Two-storey extension",
    short: "Two-storey extension",
    kind: "area",
    price: 2000,
    sizeLabel: "Total floor area, both floors",
    defaultSize: 40,
    minSize: 12,
    maxSize: 140,
    finish: { basic: 0.8, standard: 1, premium: 1.3 },
    spread: 0.12,
    excludes: "Architect, structural engineer, planning and building control fees (often 10% to 15% more), and any kitchen or bathroom fit-out.",
  },
  loft: {
    label: "Loft conversion",
    short: "Loft conversion",
    kind: "variant",
    price: 0,
    variants: [
      { id: "rooflight", label: "Rooflight (Velux)", price: 24000 },
      { id: "dormer", label: "Dormer", price: 45000 },
      { id: "hip_to_gable", label: "Hip-to-gable", price: 55000 },
      { id: "mansard", label: "Mansard", price: 70000 },
    ],
    finish: { basic: 0.9, standard: 1, premium: 1.25 },
    spread: 0.15,
    excludes: "Design, structural engineer, building control and any planning or party wall fees.",
  },
  kitchen: {
    label: "New kitchen, supplied and fitted",
    short: "Kitchen",
    kind: "variant",
    price: 0,
    variants: [
      { id: "small", label: "Small (up to 8 m²)", price: 12000 },
      { id: "medium", label: "Medium (8 to 15 m²)", price: 20000 },
      { id: "large", label: "Large (over 15 m²)", price: 32000 },
    ],
    finish: { basic: 0.7, standard: 1, premium: 1.6 },
    spread: 0.15,
    excludes: "Moving walls, new windows or doors, and premium appliances beyond the standard set.",
  },
  bathroom: {
    label: "Bathroom refit",
    short: "Bathroom",
    kind: "variant",
    price: 0,
    variants: [
      { id: "family", label: "Family bathroom", price: 8500 },
      { id: "ensuite", label: "En suite shower room", price: 6500 },
      { id: "wc", label: "Downstairs WC", price: 3500 },
    ],
    finish: { basic: 0.75, standard: 1, premium: 1.5 },
    spread: 0.15,
    excludes: "Moving the soil stack, new heating systems, and building work to make the room bigger.",
  },
  garage: {
    label: "Garage conversion",
    short: "Garage conversion",
    kind: "variant",
    price: 0,
    variants: [
      { id: "single", label: "Single garage", price: 20000 },
      { id: "double", label: "Double garage", price: 34000 },
    ],
    finish: { basic: 0.8, standard: 1, premium: 1.3 },
    spread: 0.12,
    excludes: "Building control fees, and planning permission where it's needed.",
  },
  refurb: {
    label: "Whole-house refurbishment",
    short: "Refurbishment",
    kind: "area",
    price: 750,
    sizeLabel: "Size of the house",
    defaultSize: 90,
    minSize: 30,
    maxSize: 400,
    finish: { basic: 0.55, standard: 1, premium: 1.75 },
    spread: 0.15,
    excludes: "Structural changes, extensions, and a new kitchen or bathrooms unless you add them separately.",
  },
};

export const REGIONS = [
  { id: "london", label: "London", factor: 1.25 },
  { id: "south_east", label: "South East", factor: 1.12 },
  { id: "east", label: "East of England", factor: 1.05 },
  { id: "south_west", label: "South West", factor: 1.02 },
  { id: "west_midlands", label: "West Midlands", factor: 0.97 },
  { id: "east_midlands", label: "East Midlands", factor: 0.95 },
  { id: "north_west", label: "North West", factor: 0.95 },
  { id: "yorkshire", label: "Yorkshire and the Humber", factor: 0.93 },
  { id: "north_east", label: "North East", factor: 0.9 },
  { id: "wales", label: "Wales", factor: 0.92 },
  { id: "scotland", label: "Scotland", factor: 0.97 },
  { id: "northern_ireland", label: "Northern Ireland", factor: 0.85 },
] as const;
export type RegionId = (typeof REGIONS)[number]["id"];
export const regionFactor = (id: string) => REGIONS.find((r) => r.id === id)?.factor ?? 1;

/** A company's estimator, as it set it up. Prices are per m² (area projects) or per kind (others), at standard finish. */
export const estimatorSettings = z.object({
  types: z.array(z.enum(PROJECT_TYPES)).min(1).max(PROJECT_TYPES.length),
  region: z.enum(REGIONS.map((r) => r.id) as [RegionId, ...RegionId[]]),
  /** Their prices compared with typical prices for their area, %. */
  adjustPct: z.number().int().min(-40).max(100),
  vatRegistered: z.boolean(),
  /** Their own standard-finish prices, replacing the typical ones (pounds). */
  prices: z.record(z.string().max(40), z.number().int().min(100).max(1_000_000)).optional(),
  headline: z.string().trim().max(80).optional(),
});
export type EstimatorSettings = z.infer<typeof estimatorSettings>;

export const DEFAULT_ESTIMATOR: EstimatorSettings = { types: [...PROJECT_TYPES], region: "east_midlands", adjustPct: 0, vatRegistered: true };

export type EstimateInput = { type: ProjectType; size?: number; variant?: string; finish: Finish };

export type Estimate = { low: number; mid: number; high: number; vat: boolean; perM2?: { low: number; high: number } };

const roundTo = (n: number, step: number) => Math.round(n / step) * step;

/** The price key for a company's own prices: the type for area projects, "type:variant" otherwise. */
export const priceKey = (type: ProjectType, variant?: string) => (PROJECTS[type].kind === "area" ? type : `${type}:${variant}`);

/** The standard-finish price before region and adjustment: the company's own if set, else the typical one. */
export function basePrice(type: ProjectType, variant: string | undefined, prices?: Record<string, number>): number | null {
  const spec = PROJECTS[type];
  const own = prices?.[priceKey(type, variant)];
  if (own) return own;
  if (spec.kind === "area") return spec.price;
  return spec.variants?.find((v) => v.id === variant)?.price ?? null;
}

/**
 * The price range for a project. With `ownPrices` the company's figures are already for its area, so no
 * region factor applies to them.
 */
export function estimate(input: EstimateInput, opts: { region: string; adjustPct?: number; vat: boolean; prices?: Record<string, number> }): Estimate | null {
  const spec = PROJECTS[input.type];
  if (!spec) return null;
  const base = basePrice(input.type, input.variant, opts.prices);
  if (base === null) return null;
  const own = Boolean(opts.prices?.[priceKey(input.type, input.variant)]);
  const factor = (own ? 1 : regionFactor(opts.region) * (1 + (opts.adjustPct ?? 0) / 100)) * spec.finish[input.finish];
  let mid: number;
  let perM2: Estimate["perM2"];
  if (spec.kind === "area") {
    const size = Math.min(spec.maxSize ?? 1000, Math.max(spec.minSize ?? 1, Math.round(input.size ?? spec.defaultSize ?? 1)));
    const rate = base * factor;
    mid = rate * size;
    perM2 = { low: roundTo(rate * (1 - spec.spread), 10), high: roundTo(rate * (1 + spec.spread), 10) };
  } else {
    mid = base * factor;
  }
  const vatFactor = opts.vat ? 1.2 : 1;
  const step = mid * vatFactor >= 20000 ? 1000 : 500;
  return {
    low: roundTo(mid * (1 - spec.spread) * vatFactor, step),
    mid: roundTo(mid * vatFactor, step),
    high: roundTo(mid * (1 + spec.spread) * vatFactor, step),
    vat: opts.vat,
    perM2: perM2 && { low: roundTo(perM2.low * vatFactor, 10), high: roundTo(perM2.high * vatFactor, 10) },
  };
}

export const formatPounds = (n: number) => `£${Math.round(n).toLocaleString("en-GB")}`;

/** "£42,000 to £53,000 including VAT", for enquiries and emails. */
export const describeRange = (e: Estimate) => `${formatPounds(e.low)} to ${formatPounds(e.high)}${e.vat ? " including VAT" : ""}`;

/** One line summing up what was asked for, for the lead's description. */
export function describeProject(input: EstimateInput): string {
  const spec = PROJECTS[input.type];
  const variant = spec.variants?.find((v) => v.id === input.variant)?.label;
  const size = spec.kind === "area" ? `${Math.round(input.size ?? spec.defaultSize ?? 0)} m²` : variant;
  return `${spec.label}${size ? `, ${size}` : ""}, ${FINISH_LABEL[input.finish].label.toLowerCase()} finish`;
}
