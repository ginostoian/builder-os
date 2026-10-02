/**
 * Hard limits shared by validation (Zod) and the database (CHECK constraints in src/db/schema.ts).
 * Keep them in one place so a value the app accepts can never be rejected by Postgres, and vice versa.
 */

/** Largest unit rate on a line: £10m. Fits comfortably in a Postgres `integer` (max ≈ £21.4m). */
export const MAX_RATE_PENCE = 1_000_000_000;

/** Largest quantity on a line. `numeric(12,3)` allows more; this keeps qty × rate inside safe integers. */
export const MAX_QTY = 1_000_000;
export const QTY_DECIMALS = 3;

/** Markup ceiling: 500%. */
export const MAX_MARKUP_BPS = 50_000;

/** VAT rate ceiling: 100%. UK rates are 0, 5 and 20%. */
export const MAX_VAT_BPS = 10_000;

/** Text lengths. Generous for real use, small enough to stop abuse of storage and rendering. */
export const TEXT = {
  name: 200,
  short: 50,
  email: 254,
  phone: 32,
  line: 300,
  note: 2_000,
  description: 2_000,
  terms: 20_000,
} as const;

/** Most services in one bundle. */
export const MAX_BUNDLE_ITEMS = 50;

/** Most lines on one quote and most operations in one autosave patch. */
export const MAX_LINES_PER_QUOTE = 2_000;
export const MAX_PATCH_OPS = 200;
