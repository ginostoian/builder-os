/**
 * Database schema (plan §4 "Core data model"). Tenant isolation is enforced by Postgres, not by app code:
 *
 * 1. Every tenant table has `org_id uuid not null`.
 * 2. Row-Level Security is enabled AND forced on every table (forcing is in migration 0002), with one policy
 *    that matches `org_id` to the transaction-local setting `app.org_id`. No setting → no rows.
 * 3. Foreign keys between tenant tables are composite `(org_id, x_id) → (org_id, id)`. Foreign-key checks
 *    bypass RLS, so a plain `x_id` FK would let tenant A point a row at tenant B's data.
 * 4. The app connects as a role in `builderos_app`: no ownership, no BYPASSRLS, no TRUNCATE (migration 0002).
 *
 * Limits come from src/core/limits.ts so the database rejects exactly what validation rejects.
 */
import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgPolicy,
  pgRole,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { MAX_MARKUP_BPS, MAX_QTY, MAX_RATE_PENCE, MAX_VAT_BPS, TEXT } from "../core/limits";
import { NOTIFICATION_KINDS } from "../core/notifications";
import { AUTOMATION_TRIGGERS, LEAD_SOURCES, LEAD_STAGES, LOST_REASONS, MAX_AUTOMATION_STEPS, type AutomationStep } from "../core/pipeline";
import { EXPENSE_CATEGORIES, MAX_PO_LINES, MAX_RECEIPTS, PO_STATUSES, type PoLine } from "../core/costs";
import { MAX_DIARY_PHOTOS, PROJECT_STATUSES, TASK_STATUSES, WEATHER } from "../core/projects";
import { WORKER_KINDS } from "../core/team";
import { MAX_VARIATION_PHOTOS, VARIATION_STATUSES, type VariationLine, type VariationPhoto } from "../core/variation";
import { LINE_KINDS, QUOTE_STATUSES, ROLES, SERVICE_KINDS, type Address, type PaymentPlanInput } from "../core/schemas";

/** Runtime role. Created (NOLOGIN) in migration 0000; login roles per environment are granted membership. */
export const appRole = pgRole("builderos_app").existing();

/**
 * Owner of the two Clerk lookup functions (migration 0004). NOLOGIN, no BYPASSRLS. It can read only the id
 * columns of organizations and members, through the `clerk_lookup` policies below, and nothing else.
 */
export const lookupRole = pgRole("builderos_lookup").existing();

/**
 * Owner of the billing functions (migration 0018). NOLOGIN, no BYPASSRLS. The only role that can change a
 * company's plan, Stripe ids, trial and complimentary flag; the app can only ask it to, through functions
 * that check what they're told.
 */
export const billingRole = pgRole("builderos_billing").existing();

/**
 * Owner of the platform metrics functions (migration 0019). NOLOGIN, no BYPASSRLS, read-only. It can read
 * the few columns the platform team's dashboard counts (through `platform_metrics` policies and column
 * grants), and the functions it owns return only totals and per-company counts.
 */
export const metricsRole = pgRole("builderos_metrics").existing();

/** Read-only, all rows, for the metrics role only. Column grants (migration 0019) limit what it can see. */
const metricsPolicy = () => pgPolicy("platform_metrics", { as: "permissive", for: "select", to: metricsRole, using: sql`true` });

/** Read-only, all rows, for the lookup role only. Column grants (migration 0004) limit what it can see. */
const lookupPolicy = () => pgPolicy("clerk_lookup", { as: "permissive", for: "select", to: lookupRole, using: sql`true` });

/** The tenant for the current transaction, or NULL if `withTenant` didn't set one. */
const currentOrg = sql`(select nullif(current_setting('app.org_id', true), '')::uuid)`;

const tenantPolicy = (column: AnyPgColumn) =>
  pgPolicy("tenant_isolation", {
    as: "permissive",
    for: "all",
    to: appRole,
    using: sql`${column} = ${currentOrg}`,
    withCheck: sql`${column} = ${currentOrg}`,
  });

const n = (value: number) => sql.raw(String(value));
const len = (name: string, column: AnyPgColumn, max: number, min = 1) =>
  check(name, sql`char_length(${column}) between ${n(min)} and ${n(max)}`);
const between = (name: string, column: AnyPgColumn, min: number, max: number) =>
  check(name, sql`${column} between ${n(min)} and ${n(max)}`);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

const tenantId = () => uuid("org_id").notNull();
const pk = () => uuid("id").primaryKey().defaultRandom();

export const plan = pgEnum("plan", ["free", "essentials", "pro"]);
export const memberRole = pgEnum("member_role", ROLES);
export const serviceKind = pgEnum("service_kind", SERVICE_KINDS);
export const quoteStatus = pgEnum("quote_status", QUOTE_STATUSES);
export const lineKind = pgEnum("line_kind", LINE_KINDS);

// ── Organizations (one row per tenant) ───────────────────────────────────────

export const organizations = pgTable(
  "organizations",
  {
    id: pk(),
    clerkOrgId: text("clerk_org_id").notNull().unique(),
    name: text("name").notNull(),
    tradingName: text("trading_name"),
    vatNumber: text("vat_number"),
    logoUrl: text("logo_url"),
    /** The public web enquiry form's link (/enquire/{token}); null until the company turns it on. */
    enquiryToken: text("enquiry_token").unique("organizations_enquiry_token_key"),
    brandColour: text("brand_colour"),
    plan: plan("plan").notNull().default("free"),
    stripeCustomerId: text("stripe_customer_id").unique("organizations_stripe_customer_key"),
    /** The company's own Stripe account (Connect, Express): client payments go straight to it. */
    connectAccountId: text("connect_account_id").unique("organizations_connect_account_key"),
    defaultMarkupBps: integer("default_markup_bps").notNull().default(0),
    defaultVatRateBps: integer("default_vat_rate_bps").notNull().default(2000),
    quoteTerms: text("quote_terms"),
    /** Bank transfer details shown on invoices. Digits only for sort code and account number. */
    bankAccountName: text("bank_account_name"),
    bankSortCode: text("bank_sort_code"),
    bankAccountNumber: text("bank_account_number"),
    /** Days to pay an invoice that has no date of its own. */
    paymentTermsDays: integer("payment_terms_days").notNull().default(14),
    /** Email clients about invoices before and after they're due. */
    remindersEnabled: boolean("reminders_enabled").notNull().default(true),
    /** Ask clients for a code sent to their email the first time they open the portal on a device. */
    portalSignIn: boolean("portal_sign_in").notNull().default(true),
    // ── Billing (migration 0018). Only the billing functions change these. ──
    /** Pro for free until then. New companies get 14 days; existing ones were made complimentary. */
    trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }).default(sql`now() + interval '14 days'`),
    /** Pro for free, set by the platform team (beta firms, partners). */
    comped: boolean("comped").notNull().default(false),
    stripeSubscriptionId: text("stripe_subscription_id").unique("organizations_stripe_subscription_key"),
    /** Stripe's subscription status: active, trialing, past_due, canceled, unpaid, incomplete… */
    subscriptionStatus: text("subscription_status"),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    /** The company's Stripe account for client payments can take charges / has finished onboarding. */
    connectChargesEnabled: boolean("connect_charges_enabled").notNull().default(false),
    connectDetailsSubmitted: boolean("connect_details_submitted").notNull().default(false),
    /** What the live subscription pays us a month, in pence (0 unless active or past due). Migration 0019. */
    mrrPence: integer("mrr_pence").notNull().default(0),
    /** Clerk event time of the last sync. Webhooks older than this are ignored (Svix can deliver out of order). */
    clerkSyncedAt: timestamp("clerk_synced_at", { withTimezone: true }),
    /** Set when the Clerk organization is deleted. Data is kept for a grace period, then purged (plan §7). */
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    pgPolicy("tenant_isolation", {
      as: "permissive",
      for: "all",
      to: appRole,
      using: sql`${t.id} = ${currentOrg}`,
      withCheck: sql`${t.id} = ${currentOrg}`,
    }),
    lookupPolicy(),
    pgPolicy("billing_access", { as: "permissive", for: "all", to: billingRole, using: sql`true`, withCheck: sql`true` }),
    metricsPolicy(),
    check("organizations_mrr_range", sql`${t.mrrPence} between 0 and 100000000`),
    check("organizations_subscription_status", sql`${t.subscriptionStatus} is null or ${t.subscriptionStatus} ~ '^[a-z_]{1,30}$'`),
    check("organizations_stripe_ids", sql`(${t.stripeCustomerId} is null or ${t.stripeCustomerId} ~ '^cus_[A-Za-z0-9]+$') and (${t.stripeSubscriptionId} is null or ${t.stripeSubscriptionId} ~ '^sub_[A-Za-z0-9]+$') and (${t.connectAccountId} is null or ${t.connectAccountId} ~ '^acct_[A-Za-z0-9]+$')`),
    len("organizations_name_len", t.name, TEXT.name),
    len("organizations_trading_name_len", t.tradingName, TEXT.name),
    check("organizations_logo_https", sql`${t.logoUrl} is null or ${t.logoUrl} like 'https://%'`),
    check("organizations_brand_colour_hex", sql`${t.brandColour} is null or ${t.brandColour} ~ '^#[0-9a-fA-F]{6}$'`),
    between("organizations_default_markup_range", t.defaultMarkupBps, 0, MAX_MARKUP_BPS),
    between("organizations_default_vat_range", t.defaultVatRateBps, 0, MAX_VAT_BPS),
    len("organizations_quote_terms_len", t.quoteTerms, TEXT.terms, 0),
    len("organizations_bank_account_name_len", t.bankAccountName, TEXT.name),
    check("organizations_bank_sort_code_format", sql`${t.bankSortCode} is null or ${t.bankSortCode} ~ '^[0-9]{6}$'`),
    check("organizations_bank_account_number_format", sql`${t.bankAccountNumber} is null or ${t.bankAccountNumber} ~ '^[0-9]{8}$'`),
    between("organizations_payment_terms_range", t.paymentTermsDays, 0, 120),
  ],
).enableRLS();

// ── Members (staff and employees; identity lives in Clerk) ───────────────────

export const members = pgTable(
  "members",
  {
    id: pk(),
    orgId: tenantId().references(() => organizations.id, { onDelete: "cascade" }),
    clerkUserId: text("clerk_user_id").notNull(),
    role: memberRole("role").notNull(),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    trade: text("trade"),
    dayRatePence: integer("day_rate_pence"),
    active: boolean("active").notNull().default(true),
    /** Clerk event time of the last sync, as on organizations. */
    clerkSyncedAt: timestamp("clerk_synced_at", { withTimezone: true }),
    // ── Getting started (migration 0019), per person ──
    /** When they finished or skipped the welcome tour. Null shows it on their next visit. */
    onboardingTourAt: timestamp("onboarding_tour_at", { withTimezone: true }),
    /** They closed the getting-started checklist (Settings → Getting started brings it back). */
    onboardingHidden: boolean("onboarding_hidden").notNull().default(false),
    /** Guide steps they've read ("Got it"), for steps there's nothing to do but learn. */
    onboardingSeen: text("onboarding_seen").array().notNull().default(sql`'{}'::text[]`),
    ...timestamps,
  },
  (t) => [
    tenantPolicy(t.orgId),
    lookupPolicy(),
    metricsPolicy(),
    check("members_onboarding_seen_size", sql`cardinality(${t.onboardingSeen}) <= 60`),
    unique("members_org_id_id_key").on(t.orgId, t.id),
    unique("members_org_clerk_user_key").on(t.orgId, t.clerkUserId),
    len("members_name_len", t.name, TEXT.name),
    len("members_email_len", t.email, TEXT.email),
    len("members_phone_len", t.phone, TEXT.phone, 0),
    len("members_trade_len", t.trade, TEXT.short),
    between("members_day_rate_range", t.dayRatePence, 0, MAX_RATE_PENCE),
  ],
).enableRLS();

// ── Clients ──────────────────────────────────────────────────────────────────

export const clients = pgTable(
  "clients",
  {
    id: pk(),
    orgId: tenantId().references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    address: jsonb("address").$type<Address>(),
    source: text("source"),
    notes: text("notes"),
    ownerMemberId: uuid("owner_member_id"),
    /** Hidden from the client list and pickers. Kept (not deleted) because quotes and invoices point at it. */
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    tenantPolicy(t.orgId),
    /** "Find my portal" by email (migration 0017); column grants limit it to id, org_id, email, archived_at. */
    pgPolicy("portal_email_lookup", { as: "permissive", for: "select", to: lookupRole, using: sql`true` }),
    index("clients_email_lower_idx").on(sql`lower(${t.email})`),
    unique("clients_org_id_id_key").on(t.orgId, t.id),
    foreignKey({ name: "clients_owner_member_fk", columns: [t.orgId, t.ownerMemberId], foreignColumns: [members.orgId, members.id] }),
    index("clients_org_name_idx").on(t.orgId, t.name),
    len("clients_name_len", t.name, TEXT.name),
    len("clients_email_len", t.email, TEXT.email),
    len("clients_phone_len", t.phone, TEXT.phone, 0),
    len("clients_source_len", t.source, TEXT.short),
    len("clients_notes_len", t.notes, TEXT.note, 0),
    check("clients_address_object", sql`${t.address} is null or jsonb_typeof(${t.address}) = 'object'`),
  ],
).enableRLS();

// ── Service library ──────────────────────────────────────────────────────────

export const services = pgTable(
  "services",
  {
    id: pk(),
    orgId: tenantId().references(() => organizations.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    unit: text("unit").notNull(),
    ratePence: integer("rate_pence").notNull(),
    defaultMarkupBps: integer("default_markup_bps"),
    kind: serviceKind("kind").notNull().default("service"),
    usageCount: integer("usage_count").notNull().default(0),
    /** Soft delete: quote lines keep pointing at archived services. */
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    tenantPolicy(t.orgId),
    unique("services_org_id_id_key").on(t.orgId, t.id),
    index("services_org_category_idx").on(t.orgId, t.category),
    len("services_category_len", t.category, TEXT.short),
    len("services_name_len", t.name, TEXT.line),
    len("services_description_len", t.description, TEXT.description, 0),
    len("services_unit_len", t.unit, TEXT.short),
    between("services_rate_range", t.ratePence, 0, MAX_RATE_PENCE),
    between("services_default_markup_range", t.defaultMarkupBps, 0, MAX_MARKUP_BPS),
    check("services_usage_count_nonneg", sql`${t.usageCount} >= 0`),
  ],
).enableRLS();

export const serviceBundleItems = pgTable(
  "service_bundle_items",
  {
    orgId: tenantId(),
    bundleId: uuid("bundle_id").notNull(),
    serviceId: uuid("service_id").notNull(),
    qty: numeric("qty", { precision: 12, scale: 3 }).notNull(),
  },
  (t) => [
    tenantPolicy(t.orgId),
    primaryKey({ columns: [t.bundleId, t.serviceId] }),
    foreignKey({ name: "service_bundle_items_bundle_fk", columns: [t.orgId, t.bundleId], foreignColumns: [services.orgId, services.id] }).onDelete("cascade"),
    foreignKey({ name: "service_bundle_items_service_fk", columns: [t.orgId, t.serviceId], foreignColumns: [services.orgId, services.id] }).onDelete("cascade"),
    check("service_bundle_items_not_self", sql`${t.bundleId} <> ${t.serviceId}`),
    check("service_bundle_items_qty_range", sql`${t.qty} > 0 and ${t.qty} <= ${n(MAX_QTY)}`),
  ],
).enableRLS();

// ── Quotes ───────────────────────────────────────────────────────────────────

export const quotes = pgTable(
  "quotes",
  {
    id: pk(),
    orgId: tenantId().references(() => organizations.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").notNull(),
    number: integer("number").notNull(),
    title: text("title").notNull(),
    siteAddress: jsonb("site_address").$type<Address>(),
    status: quoteStatus("status").notNull().default("draft"),
    validUntil: date("valid_until"),
    markupBps: integer("markup_bps").notNull(),
    vatRateBps: integer("vat_rate_bps").notNull(),
    /** Optimistic concurrency for patch-based autosave (plan §4). */
    version: integer("version").notNull().default(0),
    /** The payment plan (validated by paymentPlanInput); frozen into each sent version's snapshot. */
    paymentPlan: jsonb("payment_plan").$type<PaymentPlanInput>(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    tenantPolicy(t.orgId),
    unique("quotes_org_id_id_key").on(t.orgId, t.id),
    unique("quotes_org_number_key").on(t.orgId, t.number),
    foreignKey({ name: "quotes_client_fk", columns: [t.orgId, t.clientId], foreignColumns: [clients.orgId, clients.id] }),
    index("quotes_org_status_idx").on(t.orgId, t.status),
    check("quotes_number_positive", sql`${t.number} > 0`),
    len("quotes_title_len", t.title, TEXT.name),
    check("quotes_site_address_object", sql`${t.siteAddress} is null or jsonb_typeof(${t.siteAddress}) = 'object'`),
    between("quotes_markup_range", t.markupBps, 0, MAX_MARKUP_BPS),
    between("quotes_vat_range", t.vatRateBps, 0, MAX_VAT_BPS),
    check("quotes_version_nonneg", sql`${t.version} >= 0`),
    check("quotes_payment_plan_array", sql`${t.paymentPlan} is null or jsonb_typeof(${t.paymentPlan}) = 'array'`),
  ],
).enableRLS();

export const quoteSections = pgTable(
  "quote_sections",
  {
    id: pk(),
    orgId: tenantId(),
    quoteId: uuid("quote_id").notNull(),
    position: integer("position").notNull(),
    name: text("name").notNull(),
    collapsed: boolean("collapsed").notNull().default(false),
  },
  (t) => [
    tenantPolicy(t.orgId),
    unique("quote_sections_org_id_id_key").on(t.orgId, t.id),
    foreignKey({ name: "quote_sections_quote_fk", columns: [t.orgId, t.quoteId], foreignColumns: [quotes.orgId, quotes.id] }).onDelete("cascade"),
    index("quote_sections_quote_idx").on(t.orgId, t.quoteId, t.position),
    check("quote_sections_position_nonneg", sql`${t.position} >= 0`),
    len("quote_sections_name_len", t.name, TEXT.name),
  ],
).enableRLS();

export const quoteLines = pgTable(
  "quote_lines",
  {
    id: pk(),
    orgId: tenantId(),
    sectionId: uuid("section_id").notNull(),
    position: integer("position").notNull(),
    serviceId: uuid("service_id"),
    name: text("name").notNull(),
    qty: numeric("qty", { precision: 12, scale: 3 }).notNull(),
    unit: text("unit").notNull(),
    ratePence: integer("rate_pence").notNull(),
    markupBps: integer("markup_bps").notNull(),
    note: text("note"),
    noteVisible: boolean("note_visible").notNull().default(false),
    kind: lineKind("kind").notNull().default("normal"),
  },
  (t) => [
    tenantPolicy(t.orgId),
    unique("quote_lines_org_id_id_key").on(t.orgId, t.id),
    foreignKey({ name: "quote_lines_section_fk", columns: [t.orgId, t.sectionId], foreignColumns: [quoteSections.orgId, quoteSections.id] }).onDelete("cascade"),
    foreignKey({ name: "quote_lines_service_fk", columns: [t.orgId, t.serviceId], foreignColumns: [services.orgId, services.id] }),
    index("quote_lines_section_idx").on(t.orgId, t.sectionId, t.position),
    check("quote_lines_position_nonneg", sql`${t.position} >= 0`),
    len("quote_lines_name_len", t.name, TEXT.line),
    check("quote_lines_qty_range", sql`${t.qty} >= 0 and ${t.qty} <= ${n(MAX_QTY)}`),
    len("quote_lines_unit_len", t.unit, TEXT.short),
    between("quote_lines_rate_range", t.ratePence, 0, MAX_RATE_PENCE),
    between("quote_lines_markup_range", t.markupBps, 0, MAX_MARKUP_BPS),
    len("quote_lines_note_len", t.note, TEXT.note, 0),
  ],
).enableRLS();

// ── Sending, the client portal, and what clients do there ────────────────────

export const QUOTE_EVENT_KINDS = ["sent", "viewed", "commented", "replied", "accepted", "declined", "revised"] as const;
export const quoteEventKind = pgEnum("quote_event_kind", QUOTE_EVENT_KINDS);

/**
 * A client's private portal link. The token is the secret in `/portal/{token}`: 32 random bytes, base64url.
 * It's stored as-is so the office can copy the link again later; it only unlocks this client's sent quotes,
 * and rotating it (revoke + new row) kills the old link. Public pages find it through `app_portal_lookup`
 * (migration 0007), which runs as builderos_lookup and sees only the columns it needs.
 */
export const portalAccess = pgTable(
  "portal_access",
  {
    id: pk(),
    orgId: tenantId().references(() => organizations.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    lastViewedAt: timestamp("last_viewed_at", { withTimezone: true }),
  },
  (t) => [
    tenantPolicy(t.orgId),
    pgPolicy("portal_lookup", { as: "permissive", for: "select", to: lookupRole, using: sql`true` }),
    unique("portal_access_org_id_id_key").on(t.orgId, t.id),
    foreignKey({ name: "portal_access_client_fk", columns: [t.orgId, t.clientId], foreignColumns: [clients.orgId, clients.id] }).onDelete("cascade"),
    uniqueIndex("portal_access_one_active_per_client").on(t.orgId, t.clientId).where(sql`${t.revokedAt} is null`),
    check("portal_access_token_format", sql`${t.token} ~ '^[A-Za-z0-9_-]{43}$'`),
  ],
).enableRLS();

/**
 * What the client was sent: an immutable snapshot of the quote at that moment (no costs or markups, only
 * what the client sees), with a SHA-256 of it so a signature can be tied to exact content. The app role can
 * insert but never update or delete these (migration 0007).
 */
export const quoteVersions = pgTable(
  "quote_versions",
  {
    id: pk(),
    orgId: tenantId().references(() => organizations.id, { onDelete: "cascade" }),
    quoteId: uuid("quote_id").notNull(),
    versionNo: integer("version_no").notNull(),
    snapshot: jsonb("snapshot").notNull(),
    contentHash: text("content_hash").notNull(),
    totalPence: integer("total_pence").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
    sentByMemberId: uuid("sent_by_member_id"),
  },
  (t) => [
    tenantPolicy(t.orgId),
    metricsPolicy(),
    unique("quote_versions_org_id_id_key").on(t.orgId, t.id),
    unique("quote_versions_quote_version_key").on(t.orgId, t.quoteId, t.versionNo),
    foreignKey({ name: "quote_versions_quote_fk", columns: [t.orgId, t.quoteId], foreignColumns: [quotes.orgId, quotes.id] }),
    foreignKey({ name: "quote_versions_member_fk", columns: [t.orgId, t.sentByMemberId], foreignColumns: [members.orgId, members.id] }),
    check("quote_versions_version_positive", sql`${t.versionNo} > 0`),
    check("quote_versions_snapshot_object", sql`jsonb_typeof(${t.snapshot}) = 'object'`),
    check("quote_versions_hash_format", sql`${t.contentHash} ~ '^[0-9a-f]{64}$'`),
  ],
).enableRLS();

/** Timeline of a quote: sent, opened by the client, comments, decisions. Append-only. */
export const quoteEvents = pgTable(
  "quote_events",
  {
    id: pk(),
    orgId: tenantId().references(() => organizations.id, { onDelete: "cascade" }),
    quoteId: uuid("quote_id").notNull(),
    versionId: uuid("version_id"),
    kind: quoteEventKind("kind").notNull(),
    actor: text("actor").notNull(),
    memberId: uuid("member_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    tenantPolicy(t.orgId),
    foreignKey({ name: "quote_events_quote_fk", columns: [t.orgId, t.quoteId], foreignColumns: [quotes.orgId, quotes.id] }),
    foreignKey({ name: "quote_events_version_fk", columns: [t.orgId, t.versionId], foreignColumns: [quoteVersions.orgId, quoteVersions.id] }),
    index("quote_events_quote_idx").on(t.orgId, t.quoteId, t.createdAt),
    check("quote_events_actor", sql`${t.actor} in ('client', 'staff')`),
  ],
).enableRLS();

/** Comments on a sent quote, from the client or the team, optionally about one line of the snapshot. */
export const quoteComments = pgTable(
  "quote_comments",
  {
    id: pk(),
    orgId: tenantId().references(() => organizations.id, { onDelete: "cascade" }),
    quoteId: uuid("quote_id").notNull(),
    versionId: uuid("version_id").notNull(),
    /** A line id from the version's snapshot, or null for the quote as a whole. */
    lineId: uuid("line_id"),
    authorKind: text("author_kind").notNull(),
    authorName: text("author_name").notNull(),
    memberId: uuid("member_id"),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    tenantPolicy(t.orgId),
    foreignKey({ name: "quote_comments_quote_fk", columns: [t.orgId, t.quoteId], foreignColumns: [quotes.orgId, quotes.id] }),
    foreignKey({ name: "quote_comments_version_fk", columns: [t.orgId, t.versionId], foreignColumns: [quoteVersions.orgId, quoteVersions.id] }),
    foreignKey({ name: "quote_comments_member_fk", columns: [t.orgId, t.memberId], foreignColumns: [members.orgId, members.id] }),
    index("quote_comments_quote_idx").on(t.orgId, t.quoteId, t.createdAt),
    check("quote_comments_author_kind", sql`${t.authorKind} in ('client', 'staff')`),
    len("quote_comments_author_name_len", t.authorName, TEXT.name),
    len("quote_comments_body_len", t.body, TEXT.note),
  ],
).enableRLS();

/**
 * The client's decision on one version: accepted (with name and typed signature) or declined. One per
 * version; append-only. Keeps the evidence for an e-signature: who, when, from where, and the content hash
 * of exactly what they agreed to.
 */
export const quoteDecisions = pgTable(
  "quote_decisions",
  {
    id: pk(),
    orgId: tenantId().references(() => organizations.id, { onDelete: "cascade" }),
    quoteId: uuid("quote_id").notNull(),
    versionId: uuid("version_id").notNull(),
    decision: text("decision").notNull(),
    fullName: text("full_name").notNull(),
    signature: text("signature"),
    reason: text("reason"),
    contentHash: text("content_hash").notNull(),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    tenantPolicy(t.orgId),
    unique("quote_decisions_version_key").on(t.orgId, t.versionId),
    foreignKey({ name: "quote_decisions_quote_fk", columns: [t.orgId, t.quoteId], foreignColumns: [quotes.orgId, quotes.id] }),
    foreignKey({ name: "quote_decisions_version_fk", columns: [t.orgId, t.versionId], foreignColumns: [quoteVersions.orgId, quoteVersions.id] }),
    check("quote_decisions_kind", sql`${t.decision} in ('accepted', 'declined')`),
    check("quote_decisions_signed", sql`${t.decision} = 'declined' or ${t.signature} is not null`),
    len("quote_decisions_full_name_len", t.fullName, TEXT.name),
    len("quote_decisions_signature_len", t.signature, TEXT.name),
    len("quote_decisions_reason_len", t.reason, TEXT.note, 0),
    check("quote_decisions_hash_format", sql`${t.contentHash} ~ '^[0-9a-f]{64}$'`),
    len("quote_decisions_ip_len", t.ip, 64, 0),
    len("quote_decisions_user_agent_len", t.userAgent, 500, 0),
  ],
).enableRLS();

// ── Invoices (bank transfer) ──────────────────────────────────────────────────

export const invoiceStatus = pgEnum("invoice_status", ["issued", "paid", "void"]);

/**
 * An invoice, usually for one stage of an accepted quote's payment plan. Amounts, bank details and wording
 * are frozen in `snapshot` when it's raised; only the payment status changes afterwards. Invoices are voided,
 * never deleted (the app role has no DELETE, migration 0008).
 */
export const invoices = pgTable(
  "invoices",
  {
    id: pk(),
    orgId: tenantId().references(() => organizations.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    clientId: uuid("client_id").notNull(),
    quoteId: uuid("quote_id"),
    /** The plan stage this bills (an id from the accepted version's snapshot). */
    stageId: uuid("stage_id"),
    status: invoiceStatus("status").notNull().default("issued"),
    issueDate: date("issue_date").notNull(),
    dueDate: date("due_date").notNull(),
    netPence: integer("net_pence").notNull(),
    vatPence: integer("vat_pence").notNull(),
    totalPence: integer("total_pence").notNull(),
    snapshot: jsonb("snapshot").notNull(),
    paidOn: date("paid_on"),
    paidReference: text("paid_reference"),
    /** The Stripe payment that paid it online (on the company's own account), if it was paid that way. */
    stripePaymentId: text("stripe_payment_id").unique("invoices_stripe_payment_key"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdByMemberId: uuid("created_by_member_id"),
    ...timestamps,
  },
  (t) => [
    tenantPolicy(t.orgId),
    metricsPolicy(),
    pgPolicy("reminder_lookup", { as: "permissive", for: "select", to: lookupRole, using: sql`true` }),
    unique("invoices_org_id_id_key").on(t.orgId, t.id),
    unique("invoices_org_number_key").on(t.orgId, t.number),
    // One live invoice per plan stage; a voided one can be raised again.
    uniqueIndex("invoices_one_per_stage").on(t.orgId, t.quoteId, t.stageId).where(sql`${t.status} <> 'void' and ${t.stageId} is not null`),
    foreignKey({ name: "invoices_client_fk", columns: [t.orgId, t.clientId], foreignColumns: [clients.orgId, clients.id] }),
    foreignKey({ name: "invoices_quote_fk", columns: [t.orgId, t.quoteId], foreignColumns: [quotes.orgId, quotes.id] }),
    foreignKey({ name: "invoices_member_fk", columns: [t.orgId, t.createdByMemberId], foreignColumns: [members.orgId, members.id] }),
    index("invoices_org_status_due_idx").on(t.orgId, t.status, t.dueDate),
    check("invoices_number_positive", sql`${t.number} > 0`),
    between("invoices_total_range", t.totalPence, 0, MAX_RATE_PENCE),
    check("invoices_amounts_add_up", sql`${t.netPence} + ${t.vatPence} = ${t.totalPence} and ${t.netPence} >= 0 and ${t.vatPence} >= 0`),
    check("invoices_due_after_issue", sql`${t.dueDate} >= ${t.issueDate}`),
    check("invoices_paid_has_date", sql`(${t.status} = 'paid') = (${t.paidOn} is not null)`),
    check("invoices_snapshot_object", sql`jsonb_typeof(${t.snapshot}) = 'object'`),
    len("invoices_paid_reference_len", t.paidReference, TEXT.short, 0),
  ],
).enableRLS();

/** Each payment reminder emailed for an invoice: at most one of each kind (append-only). */
export const invoiceReminders = pgTable(
  "invoice_reminders",
  {
    id: pk(),
    orgId: tenantId().references(() => organizations.id, { onDelete: "cascade" }),
    invoiceId: uuid("invoice_id").notNull(),
    kind: text("kind").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    tenantPolicy(t.orgId),
    unique("invoice_reminders_once").on(t.orgId, t.invoiceId, t.kind),
    foreignKey({ name: "invoice_reminders_invoice_fk", columns: [t.orgId, t.invoiceId], foreignColumns: [invoices.orgId, invoices.id] }),
    check("invoice_reminders_kind", sql`${t.kind} in ('before', 'due', 'overdue_3', 'overdue_7')`),
  ],
).enableRLS();

// ── Variations ────────────────────────────────────────────────────────────────

export const variationStatus = pgEnum("variation_status", VARIATION_STATUSES);

/**
 * A change to an accepted quote: extra work or an omission, priced in its own lines. A draft is edited
 * freely; sending freezes the client-safe `snapshot` (with its SHA-256), and from then on only the client's
 * decision, withdrawal and billing can change (a trigger enforces that, migration 0009). Approved
 * variations are invoiced on their own or added to a payment's invoice (`invoice_id`).
 */
export const variations = pgTable(
  "variations",
  {
    id: pk(),
    orgId: tenantId().references(() => organizations.id, { onDelete: "cascade" }),
    quoteId: uuid("quote_id").notNull(),
    clientId: uuid("client_id").notNull(),
    /** 1, 2, 3… per quote. */
    number: integer("number").notNull(),
    title: text("title").notNull(),
    reason: text("reason"),
    lines: jsonb("lines").$type<VariationLine[]>().notNull().default(sql`'[]'::jsonb`),
    /** Site photos (storage keys). Frozen into the snapshot as URLs when sent. */
    photos: jsonb("photos").$type<VariationPhoto[]>().notNull().default(sql`'[]'::jsonb`),
    vatRateBps: integer("vat_rate_bps").notNull(),
    status: variationStatus("status").notNull().default("draft"),
    netPence: integer("net_pence").notNull().default(0),
    vatPence: integer("vat_pence").notNull().default(0),
    totalPence: integer("total_pence").notNull().default(0),
    snapshot: jsonb("snapshot"),
    contentHash: text("content_hash"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    sentByMemberId: uuid("sent_by_member_id"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    decisionName: text("decision_name"),
    signature: text("signature"),
    decisionReason: text("decision_reason"),
    decisionIp: text("decision_ip"),
    decisionUserAgent: text("decision_user_agent"),
    /** The invoice that bills it (approved only). Voiding that invoice frees it to be billed again. */
    invoiceId: uuid("invoice_id"),
    createdByMemberId: uuid("created_by_member_id"),
    ...timestamps,
  },
  (t) => [
    tenantPolicy(t.orgId),
    unique("variations_org_id_id_key").on(t.orgId, t.id),
    unique("variations_quote_number_key").on(t.orgId, t.quoteId, t.number),
    foreignKey({ name: "variations_quote_fk", columns: [t.orgId, t.quoteId], foreignColumns: [quotes.orgId, quotes.id] }),
    foreignKey({ name: "variations_client_fk", columns: [t.orgId, t.clientId], foreignColumns: [clients.orgId, clients.id] }),
    foreignKey({ name: "variations_invoice_fk", columns: [t.orgId, t.invoiceId], foreignColumns: [invoices.orgId, invoices.id] }),
    foreignKey({ name: "variations_sent_by_fk", columns: [t.orgId, t.sentByMemberId], foreignColumns: [members.orgId, members.id] }),
    foreignKey({ name: "variations_created_by_fk", columns: [t.orgId, t.createdByMemberId], foreignColumns: [members.orgId, members.id] }),
    index("variations_quote_idx").on(t.orgId, t.quoteId),
    check("variations_number_positive", sql`${t.number} > 0`),
    len("variations_title_len", t.title, TEXT.name),
    len("variations_reason_len", t.reason, TEXT.note, 0),
    between("variations_vat_range", t.vatRateBps, 0, MAX_VAT_BPS),
    check("variations_lines_array", sql`jsonb_typeof(${t.lines}) = 'array'`),
    check("variations_photos_array", sql`jsonb_typeof(${t.photos}) = 'array' and jsonb_array_length(${t.photos}) <= ${n(MAX_VARIATION_PHOTOS)}`),
    between("variations_total_range", t.totalPence, -MAX_RATE_PENCE, MAX_RATE_PENCE),
    check("variations_amounts_add_up", sql`${t.netPence} + ${t.vatPence} = ${t.totalPence}`),
    check("variations_sent_frozen", sql`${t.status} = 'draft' or (${t.snapshot} is not null and ${t.contentHash} ~ '^[0-9a-f]{64}$' and ${t.sentAt} is not null)`),
    check("variations_decided", sql`(${t.status} in ('approved', 'rejected')) = (${t.decidedAt} is not null)`),
    check("variations_approved_signed", sql`${t.status} <> 'approved' or (${t.signature} is not null and ${t.decisionName} is not null)`),
    check("variations_billed_when_approved", sql`${t.invoiceId} is null or ${t.status} = 'approved'`),
    len("variations_decision_name_len", t.decisionName, TEXT.name),
    len("variations_signature_len", t.signature, TEXT.name),
    len("variations_decision_reason_len", t.decisionReason, TEXT.note, 0),
    len("variations_decision_ip_len", t.decisionIp, 64, 0),
    len("variations_decision_user_agent_len", t.decisionUserAgent, 500, 0),
  ],
).enableRLS();

// ── Team ──────────────────────────────────────────────────────────────────────

export const workerKind = pgEnum("worker_kind", WORKER_KINDS);

/**
 * Everyone who works for the company, with or without a login. A worker linked to a member (`member_id`)
 * can use the site app; others are listed and assigned work by the office. Logins get a worker
 * automatically when they join (src/auth/clerk-sync.ts).
 */
export const workers = pgTable(
  "workers",
  {
    id: pk(),
    orgId: tenantId().references(() => organizations.id, { onDelete: "cascade" }),
    memberId: uuid("member_id"),
    name: text("name").notNull(),
    kind: workerKind("kind").notNull().default("employee"),
    trade: text("trade"),
    phone: text("phone"),
    email: text("email"),
    /** Cost per day, for job costing. Only roles that see costs see it. */
    dayRatePence: integer("day_rate_pence"),
    startedOn: date("started_on"),
    emergencyName: text("emergency_name"),
    emergencyPhone: text("emergency_phone"),
    notes: text("notes"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    tenantPolicy(t.orgId),
    pgPolicy("cert_lookup", { as: "permissive", for: "select", to: lookupRole, using: sql`true` }),
    unique("workers_org_id_id_key").on(t.orgId, t.id),
    uniqueIndex("workers_one_per_member").on(t.orgId, t.memberId).where(sql`${t.memberId} is not null`),
    foreignKey({ name: "workers_member_fk", columns: [t.orgId, t.memberId], foreignColumns: [members.orgId, members.id] }),
    len("workers_name_len", t.name, TEXT.name),
    len("workers_trade_len", t.trade, TEXT.short),
    len("workers_phone_len", t.phone, TEXT.phone),
    len("workers_email_len", t.email, TEXT.email),
    len("workers_emergency_name_len", t.emergencyName, TEXT.name),
    len("workers_emergency_phone_len", t.emergencyPhone, TEXT.phone),
    len("workers_notes_len", t.notes, TEXT.note, 0),
    between("workers_day_rate_range", t.dayRatePence, 0, MAX_RATE_PENCE),
  ],
).enableRLS();

/** A card, ticket or registration with an expiry date (CSCS, Gas Safe…). Office is reminded before expiry. */
export const workerCertificates = pgTable(
  "worker_certificates",
  {
    id: pk(),
    orgId: tenantId().references(() => organizations.id, { onDelete: "cascade" }),
    workerId: uuid("worker_id").notNull(),
    name: text("name").notNull(),
    reference: text("reference"),
    expiresOn: date("expires_on"),
    /** When the "expiring soon" email went out (once per certificate; cleared when the date changes). */
    remindedAt: timestamp("reminded_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    tenantPolicy(t.orgId),
    pgPolicy("cert_lookup", { as: "permissive", for: "select", to: lookupRole, using: sql`true` }),
    foreignKey({ name: "worker_certificates_worker_fk", columns: [t.orgId, t.workerId], foreignColumns: [workers.orgId, workers.id] }).onDelete("cascade"),
    index("worker_certificates_expiry_idx").on(t.orgId, t.expiresOn),
    len("worker_certificates_name_len", t.name, TEXT.name),
    len("worker_certificates_reference_len", t.reference, TEXT.short),
  ],
).enableRLS();

// ── Projects ──────────────────────────────────────────────────────────────────

export const projectStatus = pgEnum("project_status", PROJECT_STATUSES);
export const taskStatus = pgEnum("task_status", TASK_STATUSES);

/** A job being run: usually started from an accepted quote (at most one project per quote). */
export const projects = pgTable(
  "projects",
  {
    id: pk(),
    orgId: tenantId().references(() => organizations.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").notNull(),
    quoteId: uuid("quote_id"),
    name: text("name").notNull(),
    siteAddress: jsonb("site_address").$type<Address>(),
    status: projectStatus("status").notNull().default("booked"),
    startDate: date("start_date"),
    endDate: date("end_date"),
    /** Who runs the job (usually a site lead). */
    managerMemberId: uuid("manager_member_id"),
    /** Show progress, shared diary entries and shared files in the client's portal. */
    shareProgress: boolean("share_progress").notNull().default(true),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdByMemberId: uuid("created_by_member_id"),
    ...timestamps,
  },
  (t) => [
    tenantPolicy(t.orgId),
    metricsPolicy(),
    unique("projects_org_id_id_key").on(t.orgId, t.id),
    uniqueIndex("projects_one_per_quote").on(t.orgId, t.quoteId).where(sql`${t.quoteId} is not null`),
    foreignKey({ name: "projects_client_fk", columns: [t.orgId, t.clientId], foreignColumns: [clients.orgId, clients.id] }),
    foreignKey({ name: "projects_quote_fk", columns: [t.orgId, t.quoteId], foreignColumns: [quotes.orgId, quotes.id] }),
    foreignKey({ name: "projects_manager_fk", columns: [t.orgId, t.managerMemberId], foreignColumns: [members.orgId, members.id] }),
    foreignKey({ name: "projects_created_by_fk", columns: [t.orgId, t.createdByMemberId], foreignColumns: [members.orgId, members.id] }),
    index("projects_org_status_idx").on(t.orgId, t.status),
    len("projects_name_len", t.name, TEXT.name),
    check("projects_dates_order", sql`${t.endDate} is null or ${t.startDate} is null or ${t.endDate} >= ${t.startDate}`),
    check("projects_site_address_object", sql`${t.siteAddress} is null or jsonb_typeof(${t.siteAddress}) = 'object'`),
  ],
).enableRLS();

/** A stage of the job (e.g. "Strip out", "First fix"), in order. Usually the quote's sections. */
export const projectPhases = pgTable(
  "project_phases",
  {
    id: pk(),
    orgId: tenantId().references(() => organizations.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").notNull(),
    name: text("name").notNull(),
    position: integer("position").notNull(),
    ...timestamps,
  },
  (t) => [
    tenantPolicy(t.orgId),
    unique("project_phases_org_id_id_key").on(t.orgId, t.id),
    unique("project_phases_project_id_key").on(t.orgId, t.projectId, t.id),
    foreignKey({ name: "project_phases_project_fk", columns: [t.orgId, t.projectId], foreignColumns: [projects.orgId, projects.id] }).onDelete("cascade"),
    len("project_phases_name_len", t.name, TEXT.name),
  ],
).enableRLS();

/** One thing to get done on site. Board columns are statuses; `position` orders a column. */
export const projectTasks = pgTable(
  "project_tasks",
  {
    id: pk(),
    orgId: tenantId().references(() => organizations.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").notNull(),
    phaseId: uuid("phase_id"),
    title: text("title").notNull(),
    notes: text("notes"),
    status: taskStatus("status").notNull().default("todo"),
    position: integer("position").notNull().default(0),
    /** Who does it: anyone on the team, with or without a login. */
    workerId: uuid("worker_id"),
    /** Who does it when it isn't one of the team, e.g. "Electrician" or a subcontractor's name. */
    trade: text("trade"),
    startDate: date("start_date"),
    dueDate: date("due_date"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdByMemberId: uuid("created_by_member_id"),
    ...timestamps,
  },
  (t) => [
    tenantPolicy(t.orgId),
    unique("project_tasks_org_id_id_key").on(t.orgId, t.id),
    foreignKey({ name: "project_tasks_project_fk", columns: [t.orgId, t.projectId], foreignColumns: [projects.orgId, projects.id] }).onDelete("cascade"),
    // The stage must belong to the same project.
    foreignKey({ name: "project_tasks_phase_fk", columns: [t.orgId, t.projectId, t.phaseId], foreignColumns: [projectPhases.orgId, projectPhases.projectId, projectPhases.id] }),
    foreignKey({ name: "project_tasks_worker_fk", columns: [t.orgId, t.workerId], foreignColumns: [workers.orgId, workers.id] }),
    index("project_tasks_worker_idx").on(t.orgId, t.workerId),
    foreignKey({ name: "project_tasks_created_by_fk", columns: [t.orgId, t.createdByMemberId], foreignColumns: [members.orgId, members.id] }),
    index("project_tasks_project_idx").on(t.orgId, t.projectId, t.status, t.position),
    len("project_tasks_title_len", t.title, TEXT.line),
    len("project_tasks_notes_len", t.notes, TEXT.note, 0),
    len("project_tasks_trade_len", t.trade, TEXT.short),
    check("project_tasks_dates_order", sql`${t.dueDate} is null or ${t.startDate} is null or ${t.dueDate} >= ${t.startDate}`),
    check("project_tasks_done_has_time", sql`(${t.status} = 'done') = (${t.completedAt} is not null)`),
  ],
).enableRLS();

/** The site diary: what happened each day, with photos. Entries can be shared with the client. */
export const projectDiary = pgTable(
  "project_diary",
  {
    id: pk(),
    orgId: tenantId().references(() => organizations.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").notNull(),
    entryDate: date("entry_date").notNull(),
    body: text("body").notNull(),
    weather: text("weather"),
    photos: jsonb("photos").$type<{ key: string }[]>().notNull().default(sql`'[]'::jsonb`),
    shareWithClient: boolean("share_with_client").notNull().default(false),
    authorMemberId: uuid("author_member_id"),
    ...timestamps,
  },
  (t) => [
    tenantPolicy(t.orgId),
    foreignKey({ name: "project_diary_project_fk", columns: [t.orgId, t.projectId], foreignColumns: [projects.orgId, projects.id] }).onDelete("cascade"),
    foreignKey({ name: "project_diary_author_fk", columns: [t.orgId, t.authorMemberId], foreignColumns: [members.orgId, members.id] }),
    index("project_diary_project_idx").on(t.orgId, t.projectId, t.entryDate),
    len("project_diary_body_len", t.body, TEXT.note),
    check("project_diary_weather", sql`${t.weather} is null or ${t.weather} in (${sql.raw(WEATHER.map((w) => `'${w}'`).join(", "))})`),
    check("project_diary_photos_array", sql`jsonb_typeof(${t.photos}) = 'array' and jsonb_array_length(${t.photos}) <= ${n(MAX_DIARY_PHOTOS)}`),
  ],
).enableRLS();

/** Documents for the job: drawings, certificates, specs. Stored on Bunny; optionally shared with the client. */
export const projectFiles = pgTable(
  "project_files",
  {
    id: pk(),
    orgId: tenantId().references(() => organizations.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").notNull(),
    name: text("name").notNull(),
    storageKey: text("storage_key").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    shareWithClient: boolean("share_with_client").notNull().default(false),
    uploadedByMemberId: uuid("uploaded_by_member_id"),
    ...timestamps,
  },
  (t) => [
    tenantPolicy(t.orgId),
    unique("project_files_key").on(t.orgId, t.storageKey),
    foreignKey({ name: "project_files_project_fk", columns: [t.orgId, t.projectId], foreignColumns: [projects.orgId, projects.id] }).onDelete("cascade"),
    foreignKey({ name: "project_files_uploaded_by_fk", columns: [t.orgId, t.uploadedByMemberId], foreignColumns: [members.orgId, members.id] }),
    index("project_files_project_idx").on(t.orgId, t.projectId),
    len("project_files_name_len", t.name, TEXT.name),
    check("project_files_size", sql`${t.sizeBytes} > 0`),
  ],
).enableRLS();

/**
 * A worker on site: checked in (time and, if the phone allows, location) and checked out. One open visit
 * per worker at a time. These make the timesheets.
 */
export const siteVisits = pgTable(
  "site_visits",
  {
    id: pk(),
    orgId: tenantId().references(() => organizations.id, { onDelete: "cascade" }),
    workerId: uuid("worker_id").notNull(),
    projectId: uuid("project_id").notNull(),
    checkedInAt: timestamp("checked_in_at", { withTimezone: true }).notNull().defaultNow(),
    checkedOutAt: timestamp("checked_out_at", { withTimezone: true }),
    inLat: numeric("in_lat", { precision: 9, scale: 6 }),
    inLng: numeric("in_lng", { precision: 9, scale: 6 }),
    outLat: numeric("out_lat", { precision: 9, scale: 6 }),
    outLng: numeric("out_lng", { precision: 9, scale: 6 }),
    /** The worker's day rate when they checked in, for costing the job (rates change; past jobs shouldn't). */
    dayRatePence: integer("day_rate_pence"),
    ...timestamps,
  },
  (t) => [
    tenantPolicy(t.orgId),
    uniqueIndex("site_visits_one_open").on(t.orgId, t.workerId).where(sql`${t.checkedOutAt} is null`),
    foreignKey({ name: "site_visits_worker_fk", columns: [t.orgId, t.workerId], foreignColumns: [workers.orgId, workers.id] }).onDelete("cascade"),
    foreignKey({ name: "site_visits_project_fk", columns: [t.orgId, t.projectId], foreignColumns: [projects.orgId, projects.id] }).onDelete("cascade"),
    index("site_visits_worker_idx").on(t.orgId, t.workerId, t.checkedInAt),
    check("site_visits_out_after_in", sql`${t.checkedOutAt} is null or ${t.checkedOutAt} >= ${t.checkedInAt}`),
    check("site_visits_lat", sql`${t.inLat} is null or ${t.inLat} between -90 and 90`),
    check("site_visits_lng", sql`${t.inLng} is null or ${t.inLng} between -180 and 180`),
    check("site_visits_day_rate", sql`${t.dayRatePence} is null or ${t.dayRatePence} between 0 and ${n(MAX_RATE_PENCE)}`),
  ],
).enableRLS();

// ── Job costs ────────────────────────────────────────────────────────────────

export const expenseCategory = pgEnum("expense_category", EXPENSE_CATEGORIES);
export const poStatus = pgEnum("po_status", PO_STATUSES);

/** A receipt or bill: a photo or PDF stored on Bunny. */
export type Receipt = { key: string; contentType: string };

/**
 * An order to a supplier for a job: what, how many, at what price. When the supplier's bill comes in it's
 * recorded as an expense linked to the order.
 */
export const purchaseOrders = pgTable(
  "purchase_orders",
  {
    id: pk(),
    orgId: tenantId().references(() => organizations.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    projectId: uuid("project_id").notNull(),
    supplierName: text("supplier_name").notNull(),
    supplierEmail: text("supplier_email"),
    status: poStatus("status").notNull().default("draft"),
    orderedOn: date("ordered_on"),
    neededBy: date("needed_by"),
    deliveryNotes: text("delivery_notes"),
    lines: jsonb("lines").$type<PoLine[]>().notNull().default(sql`'[]'::jsonb`),
    vatRateBps: integer("vat_rate_bps").notNull().default(2000),
    netPence: integer("net_pence").notNull().default(0),
    createdByMemberId: uuid("created_by_member_id"),
    ...timestamps,
  },
  (t) => [
    tenantPolicy(t.orgId),
    unique("purchase_orders_org_id_id_key").on(t.orgId, t.id),
    unique("purchase_orders_org_number_key").on(t.orgId, t.number),
    foreignKey({ name: "purchase_orders_project_fk", columns: [t.orgId, t.projectId], foreignColumns: [projects.orgId, projects.id] }).onDelete("cascade"),
    foreignKey({ name: "purchase_orders_member_fk", columns: [t.orgId, t.createdByMemberId], foreignColumns: [members.orgId, members.id] }),
    index("purchase_orders_project_idx").on(t.orgId, t.projectId),
    check("purchase_orders_number_positive", sql`${t.number} > 0`),
    len("purchase_orders_supplier_len", t.supplierName, TEXT.name),
    len("purchase_orders_supplier_email_len", t.supplierEmail, TEXT.email),
    len("purchase_orders_delivery_notes_len", t.deliveryNotes, TEXT.note),
    between("purchase_orders_vat_range", t.vatRateBps, 0, MAX_VAT_BPS),
    between("purchase_orders_net_range", t.netPence, 0, MAX_RATE_PENCE),
    check("purchase_orders_lines_array", sql`jsonb_typeof(${t.lines}) = 'array' and jsonb_array_length(${t.lines}) <= ${n(MAX_PO_LINES)}`),
    check("purchase_orders_ordered_has_date", sql`${t.status} in ('draft', 'cancelled') or ${t.orderedOn} is not null`),
  ],
).enableRLS();

/**
 * Money spent on a job: a receipt, a supplier's bill or a subcontractor's invoice. Amounts as on the
 * receipt (VAT shown separately when there is some). `rechargeable` marks things bought on the client's
 * behalf, to bill back: on an invoice (`invoice_id`) or marked as recovered some other way.
 */
export const expenses = pgTable(
  "expenses",
  {
    id: pk(),
    orgId: tenantId().references(() => organizations.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").notNull(),
    purchaseOrderId: uuid("purchase_order_id"),
    category: expenseCategory("category").notNull().default("materials"),
    supplier: text("supplier"),
    description: text("description").notNull(),
    spentOn: date("spent_on").notNull(),
    netPence: integer("net_pence").notNull(),
    vatPence: integer("vat_pence").notNull().default(0),
    totalPence: integer("total_pence").notNull(),
    receipts: jsonb("receipts").$type<Receipt[]>().notNull().default(sql`'[]'::jsonb`),
    rechargeable: boolean("rechargeable").notNull().default(false),
    rechargeMarkupBps: integer("recharge_markup_bps").notNull().default(0),
    invoiceId: uuid("invoice_id"),
    recoveredOn: date("recovered_on"),
    createdByMemberId: uuid("created_by_member_id"),
    ...timestamps,
  },
  (t) => [
    tenantPolicy(t.orgId),
    unique("expenses_org_id_id_key").on(t.orgId, t.id),
    foreignKey({ name: "expenses_project_fk", columns: [t.orgId, t.projectId], foreignColumns: [projects.orgId, projects.id] }).onDelete("cascade"),
    foreignKey({ name: "expenses_po_fk", columns: [t.orgId, t.purchaseOrderId], foreignColumns: [purchaseOrders.orgId, purchaseOrders.id] }),
    foreignKey({ name: "expenses_invoice_fk", columns: [t.orgId, t.invoiceId], foreignColumns: [invoices.orgId, invoices.id] }),
    foreignKey({ name: "expenses_member_fk", columns: [t.orgId, t.createdByMemberId], foreignColumns: [members.orgId, members.id] }),
    index("expenses_project_idx").on(t.orgId, t.projectId, t.spentOn),
    index("expenses_po_idx").on(t.orgId, t.purchaseOrderId),
    len("expenses_supplier_len", t.supplier, TEXT.name),
    len("expenses_description_len", t.description, TEXT.line),
    between("expenses_total_range", t.totalPence, 0, MAX_RATE_PENCE),
    check("expenses_amounts_add_up", sql`${t.netPence} + ${t.vatPence} = ${t.totalPence} and ${t.netPence} >= 0 and ${t.vatPence} >= 0`),
    between("expenses_markup_range", t.rechargeMarkupBps, 0, MAX_MARKUP_BPS),
    check("expenses_receipts_array", sql`jsonb_typeof(${t.receipts}) = 'array' and jsonb_array_length(${t.receipts}) <= ${n(MAX_RECEIPTS)}`),
    check("expenses_billed_when_rechargeable", sql`${t.rechargeable} or (${t.invoiceId} is null and ${t.recoveredOn} is null)`),
  ],
).enableRLS();

// ── Sales pipeline ───────────────────────────────────────────────────────────

export const leadStage = pgEnum("lead_stage", LEAD_STAGES);
export const leadSource = pgEnum("lead_source", LEAD_SOURCES);
export const lostReason = pgEnum("lost_reason", LOST_REASONS);
export const automationTrigger = pgEnum("automation_trigger", AUTOMATION_TRIGGERS);
export const leadActivityKind = pgEnum("lead_activity_kind", ["created", "note", "call", "email", "automation_email", "stage", "visit", "quote"]);
export const automationRunStatus = pgEnum("automation_run_status", ["active", "done", "stopped"]);

/**
 * An enquiry, from first contact to won or lost. Becomes a client and a quote along the way. The
 * `unsubscribe_token` goes in automated emails; `email_opt_out` stops them for good.
 */
export const leads = pgTable(
  "leads",
  {
    id: pk(),
    orgId: tenantId().references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    address: jsonb("address").$type<Address>(),
    /** From the web form, which asks for a postcode rather than a full address. */
    postcode: text("postcode"),
    source: leadSource("source").notNull().default("other"),
    sourceDetail: text("source_detail"),
    projectType: text("project_type"),
    description: text("description"),
    budget: text("budget"),
    valuePence: integer("value_pence"),
    stage: leadStage("stage").notNull().default("new"),
    stageChangedAt: timestamp("stage_changed_at", { withTimezone: true }).notNull().defaultNow(),
    ownerMemberId: uuid("owner_member_id"),
    nextActionOn: date("next_action_on"),
    nextAction: text("next_action"),
    visitAt: timestamp("visit_at", { withTimezone: true }),
    lostReason: lostReason("lost_reason"),
    lostNote: text("lost_note"),
    clientId: uuid("client_id"),
    quoteId: uuid("quote_id"),
    emailOptOut: boolean("email_opt_out").notNull().default(false),
    unsubscribeToken: text("unsubscribe_token").notNull(),
    viaWebForm: boolean("via_web_form").notNull().default(false),
    createdByMemberId: uuid("created_by_member_id"),
    ...timestamps,
  },
  (t) => [
    tenantPolicy(t.orgId),
    metricsPolicy(),
    pgPolicy("lead_lookup", { as: "permissive", for: "select", to: lookupRole, using: sql`true` }),
    unique("leads_org_id_id_key").on(t.orgId, t.id),
    unique("leads_unsubscribe_token_key").on(t.unsubscribeToken),
    foreignKey({ name: "leads_owner_fk", columns: [t.orgId, t.ownerMemberId], foreignColumns: [members.orgId, members.id] }),
    foreignKey({ name: "leads_created_by_fk", columns: [t.orgId, t.createdByMemberId], foreignColumns: [members.orgId, members.id] }),
    foreignKey({ name: "leads_client_fk", columns: [t.orgId, t.clientId], foreignColumns: [clients.orgId, clients.id] }),
    foreignKey({ name: "leads_quote_fk", columns: [t.orgId, t.quoteId], foreignColumns: [quotes.orgId, quotes.id] }),
    index("leads_org_stage_idx").on(t.orgId, t.stage),
    index("leads_quote_idx").on(t.orgId, t.quoteId),
    index("leads_web_recent_idx").on(t.orgId, t.createdAt).where(sql`${t.viaWebForm}`),
    len("leads_name_len", t.name, TEXT.name),
    len("leads_email_len", t.email, TEXT.email),
    len("leads_phone_len", t.phone, TEXT.phone),
    len("leads_postcode_len", t.postcode, 12),
    len("leads_source_detail_len", t.sourceDetail, TEXT.name),
    len("leads_project_type_len", t.projectType, TEXT.short),
    len("leads_description_len", t.description, TEXT.note),
    len("leads_budget_len", t.budget, TEXT.short),
    len("leads_next_action_len", t.nextAction, TEXT.line),
    len("leads_lost_note_len", t.lostNote, TEXT.note),
    between("leads_value_range", t.valuePence, 0, MAX_RATE_PENCE),
    check("leads_address_object", sql`${t.address} is null or jsonb_typeof(${t.address}) = 'object'`),
    check("leads_lost_has_reason", sql`(${t.stage} = 'lost') = (${t.lostReason} is not null)`),
    check("leads_token_len", sql`char_length(${t.unsubscribeToken}) between 20 and 64`),
  ],
).enableRLS();

/** What happened with a lead, newest first on screen: notes, calls, emails, stage changes. */
export const leadActivities = pgTable(
  "lead_activities",
  {
    id: pk(),
    orgId: tenantId().references(() => organizations.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id").notNull(),
    kind: leadActivityKind("kind").notNull(),
    body: text("body").notNull(),
    memberId: uuid("member_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    tenantPolicy(t.orgId),
    foreignKey({ name: "lead_activities_lead_fk", columns: [t.orgId, t.leadId], foreignColumns: [leads.orgId, leads.id] }).onDelete("cascade"),
    foreignKey({ name: "lead_activities_member_fk", columns: [t.orgId, t.memberId], foreignColumns: [members.orgId, members.id] }),
    index("lead_activities_lead_idx").on(t.orgId, t.leadId, t.createdAt),
    len("lead_activities_body_len", t.body, 8_000),
  ],
).enableRLS();

/**
 * A company's email automation: a trigger (web enquiry, new lead, or a lead entering a stage) and steps,
 * each an email sent some days after the one before. Written and switched on by the company.
 */
export const automations = pgTable(
  "automations",
  {
    id: pk(),
    orgId: tenantId().references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    enabled: boolean("enabled").notNull().default(false),
    trigger: automationTrigger("trigger").notNull(),
    stage: leadStage("stage"),
    steps: jsonb("steps").$type<AutomationStep[]>().notNull().default(sql`'[]'::jsonb`),
    templateKey: text("template_key"),
    ...timestamps,
  },
  (t) => [
    tenantPolicy(t.orgId),
    unique("automations_org_id_id_key").on(t.orgId, t.id),
    len("automations_name_len", t.name, TEXT.name),
    check("automations_stage_for_trigger", sql`(${t.trigger} = 'stage_entered') = (${t.stage} is not null)`),
    check("automations_steps_array", sql`jsonb_typeof(${t.steps}) = 'array' and jsonb_array_length(${t.steps}) <= ${n(MAX_AUTOMATION_STEPS)}`),
  ],
).enableRLS();

/**
 * One lead going through one automation: the next step and when it's due. It stops when the lead leaves
 * the stage it started in, opts out, or the automation is switched off; at most one live run per pair.
 */
export const automationRuns = pgTable(
  "automation_runs",
  {
    id: pk(),
    orgId: tenantId().references(() => organizations.id, { onDelete: "cascade" }),
    automationId: uuid("automation_id").notNull(),
    leadId: uuid("lead_id").notNull(),
    stage: leadStage("stage").notNull(),
    status: automationRunStatus("status").notNull().default("active"),
    step: integer("step").notNull().default(0),
    nextAt: timestamp("next_at", { withTimezone: true }),
    endedReason: text("ended_reason"),
    ...timestamps,
  },
  (t) => [
    tenantPolicy(t.orgId),
    pgPolicy("automation_lookup", { as: "permissive", for: "select", to: lookupRole, using: sql`true` }),
    foreignKey({ name: "automation_runs_automation_fk", columns: [t.orgId, t.automationId], foreignColumns: [automations.orgId, automations.id] }).onDelete("cascade"),
    foreignKey({ name: "automation_runs_lead_fk", columns: [t.orgId, t.leadId], foreignColumns: [leads.orgId, leads.id] }).onDelete("cascade"),
    uniqueIndex("automation_runs_one_live").on(t.orgId, t.automationId, t.leadId).where(sql`${t.status} = 'active'`),
    index("automation_runs_due_idx").on(t.nextAt).where(sql`${t.status} = 'active'`),
    index("automation_runs_lead_idx").on(t.orgId, t.leadId),
    check("automation_runs_step", sql`${t.step} >= 0`),
    check("automation_runs_active_has_next", sql`${t.status} <> 'active' or ${t.nextAt} is not null`),
    len("automation_runs_reason_len", t.endedReason, TEXT.short),
  ],
).enableRLS();

// ── Notifications ────────────────────────────────────────────────────────────

export const notificationKind = pgEnum("notification_kind", NOTIFICATION_KINDS);

/** The bell: one row per person per event, with a link. Read ones stay until the daily clean-up. */
export const notifications = pgTable(
  "notifications",
  {
    id: pk(),
    orgId: tenantId().references(() => organizations.id, { onDelete: "cascade" }),
    memberId: uuid("member_id").notNull(),
    kind: notificationKind("kind").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    href: text("href").notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    tenantPolicy(t.orgId),
    foreignKey({ name: "notifications_member_fk", columns: [t.orgId, t.memberId], foreignColumns: [members.orgId, members.id] }).onDelete("cascade"),
    index("notifications_member_idx").on(t.orgId, t.memberId, t.createdAt),
    len("notifications_title_len", t.title, TEXT.line),
    len("notifications_body_len", t.body, 600),
    check("notifications_href_local", sql`${t.href} like '/%' and ${t.href} not like '//%'`),
  ],
).enableRLS();

// ── Survey booking (migration 0017) ──────────────────────────────────────────

/** How a company takes survey bookings. One row per company, made when it first saves the settings. */
export const surveySettings = pgTable(
  "survey_settings",
  {
    orgId: uuid("org_id")
      .primaryKey()
      .references(() => organizations.id, { onDelete: "cascade" }),
    /** Clients can book online (web form, booking links in emails). */
    enabled: boolean("enabled").notNull().default(false),
    visitMinutes: integer("visit_minutes").notNull().default(60),
    /** Travel time kept free before and after each visit. */
    bufferMinutes: integer("buffer_minutes").notNull().default(30),
    minNoticeHours: integer("min_notice_hours").notNull().default(24),
    maxDaysAhead: integer("max_days_ahead").notNull().default(21),
    /** Postcode areas covered (outward-code prefixes such as "LS" or "BD1"). Empty: anywhere. */
    postcodes: text("postcodes").array().notNull().default(sql`'{}'::text[]`),
    ...timestamps,
  },
  (t) => [
    tenantPolicy(t.orgId),
    between("survey_settings_visit_range", t.visitMinutes, 15, 480),
    between("survey_settings_buffer_range", t.bufferMinutes, 0, 240),
    between("survey_settings_notice_range", t.minNoticeHours, 0, 336),
    between("survey_settings_ahead_range", t.maxDaysAhead, 1, 90),
    check("survey_settings_postcodes_max", sql`cardinality(${t.postcodes}) <= 100`),
  ],
).enableRLS();

/** When each person does surveys: a weekly window, UK time (weekday 1 = Monday). */
export const surveyHours = pgTable(
  "survey_hours",
  {
    id: pk(),
    orgId: tenantId().references(() => organizations.id, { onDelete: "cascade" }),
    memberId: uuid("member_id").notNull(),
    weekday: integer("weekday").notNull(),
    startMinute: integer("start_minute").notNull(),
    endMinute: integer("end_minute").notNull(),
  },
  (t) => [
    tenantPolicy(t.orgId),
    foreignKey({ name: "survey_hours_member_fk", columns: [t.orgId, t.memberId], foreignColumns: [members.orgId, members.id] }).onDelete("cascade"),
    index("survey_hours_member_idx").on(t.orgId, t.memberId),
    between("survey_hours_weekday_range", t.weekday, 1, 7),
    check("survey_hours_window", sql`${t.startMinute} >= 0 and ${t.endMinute} <= 1440 and ${t.startMinute} < ${t.endMinute}`),
  ],
).enableRLS();

export const surveyBookingStatus = pgEnum("survey_booking_status", ["booked", "cancelled"]);
export const surveyBookedBy = pgEnum("survey_booked_by", ["client", "office"]);

/**
 * A survey visit to a lead. The lead's `visit_at` mirrors the live booking. An exclusion constraint (custom
 * SQL in migration 0017) stops one person having two live bookings that overlap.
 */
export const surveyBookings = pgTable(
  "survey_bookings",
  {
    id: pk(),
    orgId: tenantId().references(() => organizations.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id").notNull(),
    memberId: uuid("member_id"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    status: surveyBookingStatus("status").notNull().default("booked"),
    bookedBy: surveyBookedBy("booked_by").notNull(),
    reminderSentAt: timestamp("reminder_sent_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    tenantPolicy(t.orgId),
    pgPolicy("survey_lookup", { as: "permissive", for: "select", to: lookupRole, using: sql`true` }),
    foreignKey({ name: "survey_bookings_lead_fk", columns: [t.orgId, t.leadId], foreignColumns: [leads.orgId, leads.id] }).onDelete("cascade"),
    foreignKey({ name: "survey_bookings_member_fk", columns: [t.orgId, t.memberId], foreignColumns: [members.orgId, members.id] }),
    uniqueIndex("survey_bookings_one_live_per_lead").on(t.orgId, t.leadId).where(sql`${t.status} = 'booked'`),
    index("survey_bookings_member_time_idx").on(t.orgId, t.memberId, t.startsAt),
    index("survey_bookings_reminder_idx").on(t.startsAt).where(sql`${t.status} = 'booked' and ${t.reminderSentAt} is null`),
    check("survey_bookings_times", sql`${t.endsAt} > ${t.startsAt} and ${t.endsAt} <= ${t.startsAt} + interval '8 hours'`),
    check("survey_bookings_cancelled", sql`(${t.status} = 'cancelled') = (${t.cancelledAt} is not null)`),
  ],
).enableRLS();

// ── Client portal sign-in (migration 0017) ───────────────────────────────────

/**
 * A device a client has signed in on: a random secret in an httpOnly cookie, stored here as its SHA-256.
 * Tied to one portal link, so resetting the link signs everyone out.
 */
export const portalSessions = pgTable(
  "portal_sessions",
  {
    id: pk(),
    orgId: tenantId().references(() => organizations.id, { onDelete: "cascade" }),
    accessId: uuid("access_id").notNull(),
    secretHash: text("secret_hash").notNull().unique(),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    tenantPolicy(t.orgId),
    foreignKey({ name: "portal_sessions_access_fk", columns: [t.orgId, t.accessId], foreignColumns: [portalAccess.orgId, portalAccess.id] }).onDelete("cascade"),
    index("portal_sessions_access_idx").on(t.orgId, t.accessId),
    check("portal_sessions_hash_format", sql`${t.secretHash} ~ '^[0-9a-f]{64}$'`),
    len("portal_sessions_user_agent_len", t.userAgent, 300, 0),
  ],
).enableRLS();

export const portalCodeKind = pgEnum("portal_code_kind", ["code", "link"]);

/**
 * One-time proofs that someone can read the client's email: a 6-digit code typed in, or a sign-in link.
 * Stored as SHA-256 (with the access id mixed in for codes, so equal codes don't collide).
 */
export const portalCodes = pgTable(
  "portal_codes",
  {
    id: pk(),
    orgId: tenantId().references(() => organizations.id, { onDelete: "cascade" }),
    accessId: uuid("access_id").notNull(),
    kind: portalCodeKind("kind").notNull(),
    secretHash: text("secret_hash").notNull(),
    attempts: integer("attempts").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    tenantPolicy(t.orgId),
    foreignKey({ name: "portal_codes_access_fk", columns: [t.orgId, t.accessId], foreignColumns: [portalAccess.orgId, portalAccess.id] }).onDelete("cascade"),
    index("portal_codes_access_idx").on(t.orgId, t.accessId, t.createdAt),
    uniqueIndex("portal_codes_link_hash").on(t.secretHash).where(sql`${t.kind} = 'link'`),
    check("portal_codes_hash_format", sql`${t.secretHash} ~ '^[0-9a-f]{64}$'`),
    between("portal_codes_attempts_range", t.attempts, 0, 10),
  ],
).enableRLS();

// ── Platform metrics (migration 0019) ────────────────────────────────────────

/**
 * How much each person used the app each day (UK date): page views, and sessions (a visit after 30 minutes
 * away counts as a new one). Feeds the platform team's daily and monthly active users; nothing else.
 */
export const memberActivity = pgTable(
  "member_activity",
  {
    orgId: tenantId().references(() => organizations.id, { onDelete: "cascade" }),
    memberId: uuid("member_id").notNull(),
    day: date("day").notNull(),
    views: integer("views").notNull().default(1),
    sessions: integer("sessions").notNull().default(1),
    /** Views in the site app (/m), out of `views`. */
    siteViews: integer("site_views").notNull().default(0),
    firstAt: timestamp("first_at", { withTimezone: true }).notNull().defaultNow(),
    lastAt: timestamp("last_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    tenantPolicy(t.orgId),
    metricsPolicy(),
    primaryKey({ name: "member_activity_pkey", columns: [t.orgId, t.memberId, t.day] }),
    foreignKey({ name: "member_activity_member_fk", columns: [t.orgId, t.memberId], foreignColumns: [members.orgId, members.id] }).onDelete("cascade"),
    index("member_activity_day_idx").on(t.day),
    between("member_activity_views_range", t.views, 0, 1000000),
    between("member_activity_sessions_range", t.sessions, 0, 100000),
    check("member_activity_site_views_range", sql`${t.siteViews} between 0 and ${t.views}`),
  ],
).enableRLS();

/**
 * Every change to what a company pays us, written by the billing function as it applies a subscription.
 * MRR history, new business, upgrades, downgrades and churn are all worked out from these. The app can't
 * read or write them; the metrics role reads them for the platform dashboard.
 */
export const subscriptionEvents = pgTable(
  "subscription_events",
  {
    id: pk(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    plan: plan("plan").notNull(),
    status: text("status").notNull(),
    mrrBeforePence: integer("mrr_before_pence").notNull(),
    mrrAfterPence: integer("mrr_after_pence").notNull(),
  },
  (t) => [
    pgPolicy("billing_insert", { as: "permissive", for: "insert", to: billingRole, withCheck: sql`true` }),
    metricsPolicy(),
    index("subscription_events_at_idx").on(t.at),
    index("subscription_events_org_idx").on(t.orgId, t.at),
    check("subscription_events_status", sql`${t.status} ~ '^[a-z_]{1,30}$'`),
    check("subscription_events_mrr_range", sql`${t.mrrBeforePence} between 0 and 100000000 and ${t.mrrAfterPence} between 0 and 100000000`),
  ],
).enableRLS();
