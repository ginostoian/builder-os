-- Example-data role: owns app_remove_sample_data. NOLOGIN, no BYPASSRLS; it sees and deletes rows only in the
-- current tenant (the sample_cleanup policies), and the function deletes only what sample_records lists.
-- Created like builderos_billing (0018).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'builderos_sample') THEN
    CREATE ROLE builderos_sample NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOINHERIT;
  ELSIF NOT pg_has_role(current_user, 'builderos_sample', 'MEMBER WITH ADMIN OPTION') THEN
    RAISE EXCEPTION 'Role builderos_sample exists but % has no ADMIN option on it', current_user
      USING HINT = format('As a superuser, run: GRANT builderos_sample TO %I WITH ADMIN OPTION;', current_user);
  END IF;
  IF NOT pg_has_role(current_user, 'builderos_sample', 'SET') THEN
    EXECUTE format('GRANT builderos_sample TO %I WITH INHERIT FALSE, SET TRUE', current_user);
  END IF;
END
$$;--> statement-breakpoint
CREATE TYPE "public"."sample_kind" AS ENUM('service', 'client', 'lead', 'quote', 'invoice', 'project');--> statement-breakpoint
CREATE TABLE "sample_records" (
	"org_id" uuid NOT NULL,
	"kind" "sample_kind" NOT NULL,
	"record_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sample_records_pkey" PRIMARY KEY("org_id","kind","record_id")
);
--> statement-breakpoint
ALTER TABLE "sample_records" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "is_sample" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "sample_data" text;--> statement-breakpoint
ALTER TABLE "sample_records" ADD CONSTRAINT "sample_records_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_sample_data_value" CHECK ("organizations"."sample_data" is null or "organizations"."sample_data" in ('added', 'declined', 'removed'));--> statement-breakpoint
CREATE POLICY "sample_cleanup" ON "clients" AS PERMISSIVE FOR ALL TO "builderos_sample" USING ("clients"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "sample_cleanup" ON "invoice_reminders" AS PERMISSIVE FOR ALL TO "builderos_sample" USING ("invoice_reminders"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "sample_cleanup" ON "invoices" AS PERMISSIVE FOR ALL TO "builderos_sample" USING ("invoices"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "sample_cleanup" ON "leads" AS PERMISSIVE FOR ALL TO "builderos_sample" USING ("leads"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "sample_cleanup" ON "projects" AS PERMISSIVE FOR ALL TO "builderos_sample" USING ("projects"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "sample_cleanup" ON "quote_comments" AS PERMISSIVE FOR ALL TO "builderos_sample" USING ("quote_comments"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "sample_cleanup" ON "quote_decisions" AS PERMISSIVE FOR ALL TO "builderos_sample" USING ("quote_decisions"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "sample_cleanup" ON "quote_events" AS PERMISSIVE FOR ALL TO "builderos_sample" USING ("quote_events"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "sample_cleanup" ON "quote_versions" AS PERMISSIVE FOR ALL TO "builderos_sample" USING ("quote_versions"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "sample_cleanup" ON "quotes" AS PERMISSIVE FOR ALL TO "builderos_sample" USING ("quotes"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "sample_cleanup" ON "services" AS PERMISSIVE FOR ALL TO "builderos_sample" USING ("services"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "sample_records" AS PERMISSIVE FOR ALL TO "builderos_app" USING ("sample_records"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid)) WITH CHECK ("sample_records"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "sample_cleanup" ON "sample_records" AS PERMISSIVE FOR ALL TO "builderos_sample" USING ("sample_records"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid));;--> statement-breakpoint
ALTER TABLE "sample_records" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
-- The onboarding answer is the app's to record (organizations has column grants, 0005).
GRANT UPDATE (sample_data) ON organizations TO builderos_app;--> statement-breakpoint
-- ── Removing example data ────────────────────────────────────────────────────
-- Invoices, sent quotes and their history are records the app can never delete (0007, 0008). Example data is
-- the one exception, so it goes through this function, which deletes only the rows listed in sample_records
-- for the caller's own company. If real work was built on an example (an invoice on the example quote, say),
-- a foreign key stops it and nothing is deleted.
GRANT USAGE ON SCHEMA public TO builderos_sample;--> statement-breakpoint
GRANT SELECT, DELETE ON clients, services, quotes, quote_versions, quote_events, quote_comments, quote_decisions, invoices, invoice_reminders, projects, leads, sample_records TO builderos_sample;--> statement-breakpoint
CREATE FUNCTION app_remove_sample_data(p_org uuid)
RETURNS integer
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  removed integer := 0;
  n integer;
BEGIN
  IF p_org IS DISTINCT FROM nullif(current_setting('app.org_id', true), '')::uuid THEN
    RAISE EXCEPTION 'not this company' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.invoice_reminders r USING public.sample_records s
    WHERE s.org_id = p_org AND s.kind = 'invoice' AND r.org_id = p_org AND r.invoice_id = s.record_id;
  DELETE FROM public.invoices i USING public.sample_records s
    WHERE s.org_id = p_org AND s.kind = 'invoice' AND i.org_id = p_org AND i.id = s.record_id AND i.is_sample;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed + n;
  DELETE FROM public.leads l USING public.sample_records s
    WHERE s.org_id = p_org AND s.kind = 'lead' AND l.org_id = p_org AND l.id = s.record_id;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed + n;
  DELETE FROM public.projects p USING public.sample_records s
    WHERE s.org_id = p_org AND s.kind = 'project' AND p.org_id = p_org AND p.id = s.record_id;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed + n;
  DELETE FROM public.quote_comments c USING public.sample_records s
    WHERE s.org_id = p_org AND s.kind = 'quote' AND c.org_id = p_org AND c.quote_id = s.record_id;
  DELETE FROM public.quote_events e USING public.sample_records s
    WHERE s.org_id = p_org AND s.kind = 'quote' AND e.org_id = p_org AND e.quote_id = s.record_id;
  DELETE FROM public.quote_decisions d USING public.sample_records s
    WHERE s.org_id = p_org AND s.kind = 'quote' AND d.org_id = p_org AND d.quote_id = s.record_id;
  DELETE FROM public.quote_versions v USING public.sample_records s
    WHERE s.org_id = p_org AND s.kind = 'quote' AND v.org_id = p_org AND v.quote_id = s.record_id;
  DELETE FROM public.quotes q USING public.sample_records s
    WHERE s.org_id = p_org AND s.kind = 'quote' AND q.org_id = p_org AND q.id = s.record_id;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed + n;
  DELETE FROM public.clients c USING public.sample_records s
    WHERE s.org_id = p_org AND s.kind = 'client' AND c.org_id = p_org AND c.id = s.record_id;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed + n;
  DELETE FROM public.services v USING public.sample_records s
    WHERE s.org_id = p_org AND s.kind = 'service' AND v.org_id = p_org AND v.id = s.record_id;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed + n;
  DELETE FROM public.sample_records WHERE org_id = p_org;
  RETURN removed;
END
$$;--> statement-breakpoint
GRANT CREATE ON SCHEMA public TO builderos_sample;--> statement-breakpoint
ALTER FUNCTION app_remove_sample_data(uuid) OWNER TO builderos_sample;--> statement-breakpoint
REVOKE CREATE ON SCHEMA public FROM builderos_sample;--> statement-breakpoint
REVOKE ALL ON FUNCTION app_remove_sample_data(uuid) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_remove_sample_data(uuid) TO builderos_app;
