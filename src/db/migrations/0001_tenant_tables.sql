CREATE TYPE "public"."line_kind" AS ENUM('normal', 'pc_sum', 'provisional');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('admin', 'office', 'estimator', 'site_lead', 'employee');--> statement-breakpoint
CREATE TYPE "public"."plan" AS ENUM('free', 'essentials', 'pro');--> statement-breakpoint
CREATE TYPE "public"."quote_status" AS ENUM('draft', 'sent', 'viewed', 'accepted', 'declined', 'expired');--> statement-breakpoint
CREATE TYPE "public"."service_kind" AS ENUM('service', 'bundle');--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"address" jsonb,
	"source" text,
	"owner_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clients_org_id_id_key" UNIQUE("org_id","id"),
	CONSTRAINT "clients_name_len" CHECK (char_length("clients"."name") between 1 and 200),
	CONSTRAINT "clients_email_len" CHECK (char_length("clients"."email") between 1 and 254),
	CONSTRAINT "clients_phone_len" CHECK (char_length("clients"."phone") between 0 and 32),
	CONSTRAINT "clients_source_len" CHECK (char_length("clients"."source") between 1 and 50),
	CONSTRAINT "clients_address_object" CHECK ("clients"."address" is null or jsonb_typeof("clients"."address") = 'object')
);
--> statement-breakpoint
ALTER TABLE "clients" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"clerk_user_id" text NOT NULL,
	"role" "member_role" NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"trade" text,
	"day_rate_pence" integer,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "members_org_id_id_key" UNIQUE("org_id","id"),
	CONSTRAINT "members_org_clerk_user_key" UNIQUE("org_id","clerk_user_id"),
	CONSTRAINT "members_name_len" CHECK (char_length("members"."name") between 1 and 200),
	CONSTRAINT "members_email_len" CHECK (char_length("members"."email") between 1 and 254),
	CONSTRAINT "members_phone_len" CHECK (char_length("members"."phone") between 0 and 32),
	CONSTRAINT "members_trade_len" CHECK (char_length("members"."trade") between 1 and 50),
	CONSTRAINT "members_day_rate_range" CHECK ("members"."day_rate_pence" between 0 and 1000000000)
);
--> statement-breakpoint
ALTER TABLE "members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_org_id" text NOT NULL,
	"name" text NOT NULL,
	"trading_name" text,
	"vat_number" text,
	"logo_url" text,
	"brand_colour" text,
	"plan" "plan" DEFAULT 'free' NOT NULL,
	"stripe_customer_id" text,
	"connect_account_id" text,
	"default_markup_bps" integer DEFAULT 0 NOT NULL,
	"default_vat_rate_bps" integer DEFAULT 2000 NOT NULL,
	"quote_terms" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_clerk_org_id_unique" UNIQUE("clerk_org_id"),
	CONSTRAINT "organizations_name_len" CHECK (char_length("organizations"."name") between 1 and 200),
	CONSTRAINT "organizations_trading_name_len" CHECK (char_length("organizations"."trading_name") between 1 and 200),
	CONSTRAINT "organizations_logo_https" CHECK ("organizations"."logo_url" is null or "organizations"."logo_url" like 'https://%'),
	CONSTRAINT "organizations_brand_colour_hex" CHECK ("organizations"."brand_colour" is null or "organizations"."brand_colour" ~ '^#[0-9a-fA-F]{6}$'),
	CONSTRAINT "organizations_default_markup_range" CHECK ("organizations"."default_markup_bps" between 0 and 50000),
	CONSTRAINT "organizations_default_vat_range" CHECK ("organizations"."default_vat_rate_bps" between 0 and 10000),
	CONSTRAINT "organizations_quote_terms_len" CHECK (char_length("organizations"."quote_terms") between 0 and 20000)
);
--> statement-breakpoint
ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quote_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"section_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"service_id" uuid,
	"name" text NOT NULL,
	"qty" numeric(12, 3) NOT NULL,
	"unit" text NOT NULL,
	"rate_pence" integer NOT NULL,
	"markup_bps" integer NOT NULL,
	"note" text,
	"note_visible" boolean DEFAULT false NOT NULL,
	"kind" "line_kind" DEFAULT 'normal' NOT NULL,
	CONSTRAINT "quote_lines_org_id_id_key" UNIQUE("org_id","id"),
	CONSTRAINT "quote_lines_position_nonneg" CHECK ("quote_lines"."position" >= 0),
	CONSTRAINT "quote_lines_name_len" CHECK (char_length("quote_lines"."name") between 1 and 300),
	CONSTRAINT "quote_lines_qty_range" CHECK ("quote_lines"."qty" >= 0 and "quote_lines"."qty" <= 1000000),
	CONSTRAINT "quote_lines_unit_len" CHECK (char_length("quote_lines"."unit") between 1 and 50),
	CONSTRAINT "quote_lines_rate_range" CHECK ("quote_lines"."rate_pence" between 0 and 1000000000),
	CONSTRAINT "quote_lines_markup_range" CHECK ("quote_lines"."markup_bps" between 0 and 50000),
	CONSTRAINT "quote_lines_note_len" CHECK (char_length("quote_lines"."note") between 0 and 2000)
);
--> statement-breakpoint
ALTER TABLE "quote_lines" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quote_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"quote_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"name" text NOT NULL,
	"collapsed" boolean DEFAULT false NOT NULL,
	CONSTRAINT "quote_sections_org_id_id_key" UNIQUE("org_id","id"),
	CONSTRAINT "quote_sections_position_nonneg" CHECK ("quote_sections"."position" >= 0),
	CONSTRAINT "quote_sections_name_len" CHECK (char_length("quote_sections"."name") between 1 and 200)
);
--> statement-breakpoint
ALTER TABLE "quote_sections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"title" text NOT NULL,
	"site_address" jsonb,
	"status" "quote_status" DEFAULT 'draft' NOT NULL,
	"valid_until" date,
	"markup_bps" integer NOT NULL,
	"vat_rate_bps" integer NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"sent_at" timestamp with time zone,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quotes_org_id_id_key" UNIQUE("org_id","id"),
	CONSTRAINT "quotes_org_number_key" UNIQUE("org_id","number"),
	CONSTRAINT "quotes_number_positive" CHECK ("quotes"."number" > 0),
	CONSTRAINT "quotes_title_len" CHECK (char_length("quotes"."title") between 1 and 200),
	CONSTRAINT "quotes_site_address_object" CHECK ("quotes"."site_address" is null or jsonb_typeof("quotes"."site_address") = 'object'),
	CONSTRAINT "quotes_markup_range" CHECK ("quotes"."markup_bps" between 0 and 50000),
	CONSTRAINT "quotes_vat_range" CHECK ("quotes"."vat_rate_bps" between 0 and 10000),
	CONSTRAINT "quotes_version_nonneg" CHECK ("quotes"."version" >= 0)
);
--> statement-breakpoint
ALTER TABLE "quotes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "service_bundle_items" (
	"org_id" uuid NOT NULL,
	"bundle_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"qty" numeric(12, 3) NOT NULL,
	CONSTRAINT "service_bundle_items_bundle_id_service_id_pk" PRIMARY KEY("bundle_id","service_id"),
	CONSTRAINT "service_bundle_items_not_self" CHECK ("service_bundle_items"."bundle_id" <> "service_bundle_items"."service_id"),
	CONSTRAINT "service_bundle_items_qty_range" CHECK ("service_bundle_items"."qty" > 0 and "service_bundle_items"."qty" <= 1000000)
);
--> statement-breakpoint
ALTER TABLE "service_bundle_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"category" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"unit" text NOT NULL,
	"rate_pence" integer NOT NULL,
	"default_markup_bps" integer,
	"kind" "service_kind" DEFAULT 'service' NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "services_org_id_id_key" UNIQUE("org_id","id"),
	CONSTRAINT "services_category_len" CHECK (char_length("services"."category") between 1 and 50),
	CONSTRAINT "services_name_len" CHECK (char_length("services"."name") between 1 and 300),
	CONSTRAINT "services_description_len" CHECK (char_length("services"."description") between 0 and 2000),
	CONSTRAINT "services_unit_len" CHECK (char_length("services"."unit") between 1 and 50),
	CONSTRAINT "services_rate_range" CHECK ("services"."rate_pence" between 0 and 1000000000),
	CONSTRAINT "services_default_markup_range" CHECK ("services"."default_markup_bps" between 0 and 50000),
	CONSTRAINT "services_usage_count_nonneg" CHECK ("services"."usage_count" >= 0)
);
--> statement-breakpoint
ALTER TABLE "services" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_owner_member_fk" FOREIGN KEY ("org_id","owner_member_id") REFERENCES "public"."members"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_lines" ADD CONSTRAINT "quote_lines_section_fk" FOREIGN KEY ("org_id","section_id") REFERENCES "public"."quote_sections"("org_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_lines" ADD CONSTRAINT "quote_lines_service_fk" FOREIGN KEY ("org_id","service_id") REFERENCES "public"."services"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_sections" ADD CONSTRAINT "quote_sections_quote_fk" FOREIGN KEY ("org_id","quote_id") REFERENCES "public"."quotes"("org_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_client_fk" FOREIGN KEY ("org_id","client_id") REFERENCES "public"."clients"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_bundle_items" ADD CONSTRAINT "service_bundle_items_bundle_fk" FOREIGN KEY ("org_id","bundle_id") REFERENCES "public"."services"("org_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_bundle_items" ADD CONSTRAINT "service_bundle_items_service_fk" FOREIGN KEY ("org_id","service_id") REFERENCES "public"."services"("org_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "clients_org_name_idx" ON "clients" USING btree ("org_id","name");--> statement-breakpoint
CREATE INDEX "quote_lines_section_idx" ON "quote_lines" USING btree ("org_id","section_id","position");--> statement-breakpoint
CREATE INDEX "quote_sections_quote_idx" ON "quote_sections" USING btree ("org_id","quote_id","position");--> statement-breakpoint
CREATE INDEX "quotes_org_status_idx" ON "quotes" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "services_org_category_idx" ON "services" USING btree ("org_id","category");--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "clients" AS PERMISSIVE FOR ALL TO "builderos_app" USING ("clients"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid)) WITH CHECK ("clients"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "members" AS PERMISSIVE FOR ALL TO "builderos_app" USING ("members"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid)) WITH CHECK ("members"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "organizations" AS PERMISSIVE FOR ALL TO "builderos_app" USING ("organizations"."id" = (select nullif(current_setting('app.org_id', true), '')::uuid)) WITH CHECK ("organizations"."id" = (select nullif(current_setting('app.org_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "quote_lines" AS PERMISSIVE FOR ALL TO "builderos_app" USING ("quote_lines"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid)) WITH CHECK ("quote_lines"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "quote_sections" AS PERMISSIVE FOR ALL TO "builderos_app" USING ("quote_sections"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid)) WITH CHECK ("quote_sections"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "quotes" AS PERMISSIVE FOR ALL TO "builderos_app" USING ("quotes"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid)) WITH CHECK ("quotes"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "service_bundle_items" AS PERMISSIVE FOR ALL TO "builderos_app" USING ("service_bundle_items"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid)) WITH CHECK ("service_bundle_items"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "services" AS PERMISSIVE FOR ALL TO "builderos_app" USING ("services"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid)) WITH CHECK ("services"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid));