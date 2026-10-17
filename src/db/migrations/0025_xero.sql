CREATE TYPE "public"."xero_job_status" AS ENUM('pending', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."xero_link_kind" AS ENUM('contact', 'invoice', 'payment', 'tracking');--> statement-breakpoint
CREATE TYPE "public"."xero_status" AS ENUM('active', 'reconnect');--> statement-breakpoint
CREATE TABLE "xero_connections" (
	"org_id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"tenant_name" text NOT NULL,
	"connection_id" text NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text NOT NULL,
	"access_expires_at" timestamp with time zone NOT NULL,
	"status" "xero_status" DEFAULT 'active' NOT NULL,
	"settings" jsonb,
	"vat_registered" boolean DEFAULT true NOT NULL,
	"last_error" text,
	"last_synced_at" timestamp with time zone,
	"connected_by_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "xero_connections_tenant_key" UNIQUE("tenant_id"),
	CONSTRAINT "xero_connections_tenant_name_len" CHECK (char_length("xero_connections"."tenant_name") between 1 and 200),
	CONSTRAINT "xero_connections_last_error_len" CHECK (char_length("xero_connections"."last_error") between 0 and 1000),
	CONSTRAINT "xero_connections_settings_object" CHECK ("xero_connections"."settings" is null or jsonb_typeof("xero_connections"."settings") = 'object')
);
--> statement-breakpoint
ALTER TABLE "xero_connections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "xero_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"status" "xero_job_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"run_after" timestamp with time zone DEFAULT now() NOT NULL,
	"last_error" text,
	"done_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "xero_jobs_attempts_range" CHECK ("xero_jobs"."attempts" between 0 and 1000),
	CONSTRAINT "xero_jobs_last_error_len" CHECK (char_length("xero_jobs"."last_error") between 0 and 1000)
);
--> statement-breakpoint
ALTER TABLE "xero_jobs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "xero_links" (
	"org_id" uuid NOT NULL,
	"kind" "xero_link_kind" NOT NULL,
	"local_id" uuid NOT NULL,
	"xero_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "xero_links_pkey" PRIMARY KEY("org_id","kind","local_id")
);
--> statement-breakpoint
ALTER TABLE "xero_links" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "xero_connections" ADD CONSTRAINT "xero_connections_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xero_connections" ADD CONSTRAINT "xero_connections_member_fk" FOREIGN KEY ("org_id","connected_by_member_id") REFERENCES "public"."members"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xero_jobs" ADD CONSTRAINT "xero_jobs_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xero_jobs" ADD CONSTRAINT "xero_jobs_invoice_fk" FOREIGN KEY ("org_id","invoice_id") REFERENCES "public"."invoices"("org_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xero_links" ADD CONSTRAINT "xero_links_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "xero_jobs_one_open" ON "xero_jobs" USING btree ("org_id","invoice_id") WHERE "xero_jobs"."status" <> 'done';--> statement-breakpoint
CREATE INDEX "xero_jobs_due_idx" ON "xero_jobs" USING btree ("status","run_after");--> statement-breakpoint
CREATE INDEX "xero_jobs_org_idx" ON "xero_jobs" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE INDEX "xero_links_xero_idx" ON "xero_links" USING btree ("org_id","kind","xero_id");--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "xero_connections" AS PERMISSIVE FOR ALL TO "builderos_app" USING ("xero_connections"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid)) WITH CHECK ("xero_connections"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "xero_lookup" ON "xero_connections" AS PERMISSIVE FOR SELECT TO "builderos_lookup" USING (true);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "xero_jobs" AS PERMISSIVE FOR ALL TO "builderos_app" USING ("xero_jobs"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid)) WITH CHECK ("xero_jobs"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "xero_jobs_lookup" ON "xero_jobs" AS PERMISSIVE FOR SELECT TO "builderos_lookup" USING (true);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "xero_links" AS PERMISSIVE FOR ALL TO "builderos_app" USING ("xero_links"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid)) WITH CHECK ("xero_links"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid));;--> statement-breakpoint
-- ── RLS applies to the owner too (see 0002) ──────────────────────────────────
ALTER TABLE "xero_connections" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "xero_links" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "xero_jobs" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
-- ── Lookups with no session ──────────────────────────────────────────────────
-- A Xero webhook names the Xero organisation, not the company; the scheduled run needs the companies with
-- Xero work due. Each returns company ids and nothing else; the work then runs inside that tenant.
GRANT SELECT (org_id, tenant_id) ON xero_connections TO builderos_lookup;--> statement-breakpoint
GRANT SELECT (org_id, status, run_after) ON xero_jobs TO builderos_lookup;--> statement-breakpoint
CREATE FUNCTION app_xero_org_by_tenant(p_tenant text)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT c.org_id FROM public.xero_connections c JOIN public.organizations o ON o.id = c.org_id WHERE c.tenant_id = p_tenant AND o.deleted_at IS NULL
$$;--> statement-breakpoint
CREATE FUNCTION app_orgs_with_due_xero_jobs(p_now timestamptz)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT DISTINCT j.org_id FROM public.xero_jobs j JOIN public.organizations o ON o.id = j.org_id WHERE j.status = 'pending' AND j.run_after <= p_now AND o.deleted_at IS NULL
$$;--> statement-breakpoint
CREATE FUNCTION app_orgs_with_xero()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT c.org_id FROM public.xero_connections c JOIN public.organizations o ON o.id = c.org_id WHERE o.deleted_at IS NULL
$$;--> statement-breakpoint
GRANT CREATE ON SCHEMA public TO builderos_lookup;--> statement-breakpoint
ALTER FUNCTION app_xero_org_by_tenant(text) OWNER TO builderos_lookup;--> statement-breakpoint
ALTER FUNCTION app_orgs_with_xero() OWNER TO builderos_lookup;--> statement-breakpoint
ALTER FUNCTION app_orgs_with_due_xero_jobs(timestamptz) OWNER TO builderos_lookup;--> statement-breakpoint
REVOKE CREATE ON SCHEMA public FROM builderos_lookup;--> statement-breakpoint
REVOKE ALL ON FUNCTION app_xero_org_by_tenant(text) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION app_orgs_with_xero() FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_orgs_with_xero() TO builderos_app;--> statement-breakpoint
REVOKE ALL ON FUNCTION app_orgs_with_due_xero_jobs(timestamptz) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_xero_org_by_tenant(text) TO builderos_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_orgs_with_due_xero_jobs(timestamptz) TO builderos_app;
