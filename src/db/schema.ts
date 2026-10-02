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
