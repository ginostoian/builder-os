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
import { LINE_KINDS, QUOTE_STATUSES, ROLES, SERVICE_KINDS, type Address } from "../core/schemas";

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
