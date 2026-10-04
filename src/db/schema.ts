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
    brandColour: text("brand_colour"),
    plan: plan("plan").notNull().default("free"),
    stripeCustomerId: text("stripe_customer_id"),
    connectAccountId: text("connect_account_id"),
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
    ...timestamps,
  },
  (t) => [
    tenantPolicy(t.orgId),
    lookupPolicy(),
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
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdByMemberId: uuid("created_by_member_id"),
    ...timestamps,
  },
  (t) => [
    tenantPolicy(t.orgId),
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
  ],
).enableRLS();
