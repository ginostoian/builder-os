/**
 * Plans and what each one unlocks (the Pricing page). Plans are per company, not per seat:
 *
 * - Free: quoting only. 3 sent quotes a month, 25 library items.
 * - Essentials (£49 + VAT): getting paid. Unlimited quotes, variations, payment plans, invoicing and online
 *   payments, reminders, bundles, your branding.
 * - Pro (£119 + VAT): running the business. Projects, client portal progress, team and site app, job
 *   costing, pipeline and automations, online survey booking, calendar, full reports.
 *
 * New companies get Pro free for 14 days, no card. Companies can be "complimentary" (Pro for free, set by
 * the platform team). Check features with `planHas`, never by comparing plan names.
 */

export const PLANS = ["free", "essentials", "pro"] as const;
export type Plan = (typeof PLANS)[number];

export const PLAN_LABEL: Record<Plan, string> = { free: "Free", essentials: "Essentials", pro: "Pro" };
/** Monthly price in pence, excluding VAT. */
export const PLAN_PRICE_PENCE: Record<Exclude<Plan, "free">, number> = { essentials: 4_900, pro: 11_900 };
/** Stripe price lookup keys (created by `pnpm stripe:setup`). */
export const PLAN_LOOKUP_KEY: Record<Exclude<Plan, "free">, string> = { essentials: "builderos_essentials_monthly", pro: "builderos_pro_monthly" };

export const TRIAL_DAYS = 14;
export const FREE_QUOTES_PER_MONTH = 3;
export const FREE_LIBRARY_ITEMS = 25;

/** Feature → the cheapest plan that has it. */
export const FEATURES = {
  /** Quotes beyond the Free monthly allowance, and a library beyond 25 items. */
  unlimited_quotes: "essentials",
  bundles: "essentials",
  branding: "essentials",
  variations: "essentials",
  /** Payment plans, invoices, online payments and payment reminders. */
  invoicing: "essentials",
  projects: "pro",
  team: "pro",
  site_app: "pro",
  costs: "pro",
  pipeline: "pro",
  automations: "pro",
  calendar: "pro",
  reports: "pro",
} as const satisfies Record<string, Plan>;
export type Feature = keyof typeof FEATURES;

export const FEATURE_LABEL: Record<Feature, string> = {
  unlimited_quotes: "Unlimited quotes",
  bundles: "Bundles",
  branding: "Your branding on quotes and invoices",
  variations: "Variations",
  invoicing: "Payment plans, invoices and online payments",
  projects: "Projects",
  team: "Team, timesheets and certificates",
  site_app: "The site app",
  costs: "Job costing and purchases",
  pipeline: "The sales pipeline",
  automations: "Email automations",
  calendar: "The calendar",
  reports: "Reports",
};

const RANK: Record<Plan, number> = { free: 0, essentials: 1, pro: 2 };

export const planHas = (plan: Plan, feature: Feature) => RANK[plan] >= RANK[FEATURES[feature]];

/** Stripe subscription statuses that still give the paid plan. Past due: a grace period while Stripe retries. */
const LIVE = new Set(["active", "trialing", "past_due"]);

export type BillingFacts = {
  plan: Plan;
  comped: boolean;
  trialEndsAt: Date | null;
  subscriptionStatus: string | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
};

export type Entitlement = {
  plan: Plan;
  why: "comped" | "subscription" | "trial" | "free";
  /** Whole days of trial left (trial only). */
  trialDaysLeft: number | null;
  /** Paying, but the last payment failed. */
  pastDue: boolean;
};

/** What a company can use right now. */
export function entitlement(b: BillingFacts, now: Date): Entitlement {
  if (b.comped) return { plan: "pro", why: "comped", trialDaysLeft: null, pastDue: false };
  if (b.plan !== "free" && b.subscriptionStatus && LIVE.has(b.subscriptionStatus)) {
    return { plan: b.plan, why: "subscription", trialDaysLeft: null, pastDue: b.subscriptionStatus === "past_due" };
  }
  if (b.trialEndsAt && b.trialEndsAt.getTime() > now.getTime()) {
    return { plan: "pro", why: "trial", trialDaysLeft: Math.ceil((b.trialEndsAt.getTime() - now.getTime()) / 86_400_000), pastDue: false };
  }
  return { plan: "free", why: "free", trialDaysLeft: null, pastDue: false };
}

/** The plan a Stripe price stands for, from its lookup key. */
export function planForLookupKey(key: string | null | undefined): Plan | null {
  const hit = (Object.entries(PLAN_LOOKUP_KEY) as [Exclude<Plan, "free">, string][]).find(([, k]) => k === key);
  return hit ? hit[0] : null;
}

/** The plan that unlocks a feature, for upgrade prompts ("Upgrade to Pro"). */
export const planFor = (feature: Feature): Plan => FEATURES[feature];
