CREATE TYPE "public"."automation_run_status" AS ENUM('active', 'done', 'stopped');--> statement-breakpoint
CREATE TYPE "public"."automation_trigger" AS ENUM('web_enquiry', 'lead_created', 'stage_entered');--> statement-breakpoint
CREATE TYPE "public"."lead_activity_kind" AS ENUM('created', 'note', 'call', 'email', 'automation_email', 'stage', 'visit', 'quote');--> statement-breakpoint
CREATE TYPE "public"."lead_source" AS ENUM('website', 'referral', 'repeat', 'google', 'facebook', 'instagram', 'checkatrade', 'mybuilder', 'rated_people', 'signage', 'other');--> statement-breakpoint
CREATE TYPE "public"."lead_stage" AS ENUM('new', 'contacted', 'site_visit', 'quoting', 'quote_sent', 'won', 'lost');--> statement-breakpoint
CREATE TYPE "public"."lost_reason" AS ENUM('price', 'went_elsewhere', 'timing', 'no_response', 'not_a_fit', 'declined_quote', 'other');--> statement-breakpoint
CREATE TABLE "automation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"automation_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"stage" "lead_stage" NOT NULL,
	"status" "automation_run_status" DEFAULT 'active' NOT NULL,
	"step" integer DEFAULT 0 NOT NULL,
	"next_at" timestamp with time zone,
	"ended_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "automation_runs_step" CHECK ("automation_runs"."step" >= 0),
	CONSTRAINT "automation_runs_active_has_next" CHECK ("automation_runs"."status" <> 'active' or "automation_runs"."next_at" is not null),
	CONSTRAINT "automation_runs_reason_len" CHECK (char_length("automation_runs"."ended_reason") between 1 and 50)
);
--> statement-breakpoint
ALTER TABLE "automation_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "automations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"trigger" "automation_trigger" NOT NULL,
	"stage" "lead_stage",
	"steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"template_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "automations_org_id_id_key" UNIQUE("org_id","id"),
	CONSTRAINT "automations_name_len" CHECK (char_length("automations"."name") between 1 and 200),
	CONSTRAINT "automations_stage_for_trigger" CHECK (("automations"."trigger" = 'stage_entered') = ("automations"."stage" is not null)),
	CONSTRAINT "automations_steps_array" CHECK (jsonb_typeof("automations"."steps") = 'array' and jsonb_array_length("automations"."steps") <= 10)
);
--> statement-breakpoint
ALTER TABLE "automations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lead_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"kind" "lead_activity_kind" NOT NULL,
	"body" text NOT NULL,
	"member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lead_activities_body_len" CHECK (char_length("lead_activities"."body") between 1 and 8000)
);
--> statement-breakpoint
ALTER TABLE "lead_activities" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"address" jsonb,
	"postcode" text,
	"source" "lead_source" DEFAULT 'other' NOT NULL,
	"source_detail" text,
	"project_type" text,
	"description" text,
	"budget" text,
	"value_pence" integer,
	"stage" "lead_stage" DEFAULT 'new' NOT NULL,
	"stage_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_member_id" uuid,
	"next_action_on" date,
	"next_action" text,
	"visit_at" timestamp with time zone,
	"lost_reason" "lost_reason",
	"lost_note" text,
	"client_id" uuid,
	"quote_id" uuid,
	"email_opt_out" boolean DEFAULT false NOT NULL,
	"unsubscribe_token" text NOT NULL,
	"via_web_form" boolean DEFAULT false NOT NULL,
	"created_by_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "leads_org_id_id_key" UNIQUE("org_id","id"),
	CONSTRAINT "leads_unsubscribe_token_key" UNIQUE("unsubscribe_token"),
	CONSTRAINT "leads_name_len" CHECK (char_length("leads"."name") between 1 and 200),
	CONSTRAINT "leads_email_len" CHECK (char_length("leads"."email") between 1 and 254),
	CONSTRAINT "leads_phone_len" CHECK (char_length("leads"."phone") between 1 and 32),
	CONSTRAINT "leads_postcode_len" CHECK (char_length("leads"."postcode") between 1 and 12),
	CONSTRAINT "leads_source_detail_len" CHECK (char_length("leads"."source_detail") between 1 and 200),
	CONSTRAINT "leads_project_type_len" CHECK (char_length("leads"."project_type") between 1 and 50),
	CONSTRAINT "leads_description_len" CHECK (char_length("leads"."description") between 1 and 2000),
	CONSTRAINT "leads_budget_len" CHECK (char_length("leads"."budget") between 1 and 50),
	CONSTRAINT "leads_next_action_len" CHECK (char_length("leads"."next_action") between 1 and 300),
	CONSTRAINT "leads_lost_note_len" CHECK (char_length("leads"."lost_note") between 1 and 2000),
	CONSTRAINT "leads_value_range" CHECK ("leads"."value_pence" between 0 and 1000000000),
	CONSTRAINT "leads_address_object" CHECK ("leads"."address" is null or jsonb_typeof("leads"."address") = 'object'),
	CONSTRAINT "leads_lost_has_reason" CHECK (("leads"."stage" = 'lost') = ("leads"."lost_reason" is not null)),
	CONSTRAINT "leads_token_len" CHECK (char_length("leads"."unsubscribe_token") between 20 and 64)
);
--> statement-breakpoint
ALTER TABLE "leads" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "enquiry_token" text;--> statement-breakpoint
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_automation_fk" FOREIGN KEY ("org_id","automation_id") REFERENCES "public"."automations"("org_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_lead_fk" FOREIGN KEY ("org_id","lead_id") REFERENCES "public"."leads"("org_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automations" ADD CONSTRAINT "automations_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_lead_fk" FOREIGN KEY ("org_id","lead_id") REFERENCES "public"."leads"("org_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_member_fk" FOREIGN KEY ("org_id","member_id") REFERENCES "public"."members"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_owner_fk" FOREIGN KEY ("org_id","owner_member_id") REFERENCES "public"."members"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_created_by_fk" FOREIGN KEY ("org_id","created_by_member_id") REFERENCES "public"."members"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_client_fk" FOREIGN KEY ("org_id","client_id") REFERENCES "public"."clients"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_quote_fk" FOREIGN KEY ("org_id","quote_id") REFERENCES "public"."quotes"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "automation_runs_one_live" ON "automation_runs" USING btree ("org_id","automation_id","lead_id") WHERE "automation_runs"."status" = 'active';--> statement-breakpoint
CREATE INDEX "automation_runs_due_idx" ON "automation_runs" USING btree ("next_at") WHERE "automation_runs"."status" = 'active';--> statement-breakpoint
CREATE INDEX "automation_runs_lead_idx" ON "automation_runs" USING btree ("org_id","lead_id");--> statement-breakpoint
CREATE INDEX "lead_activities_lead_idx" ON "lead_activities" USING btree ("org_id","lead_id","created_at");--> statement-breakpoint
CREATE INDEX "leads_org_stage_idx" ON "leads" USING btree ("org_id","stage");--> statement-breakpoint
CREATE INDEX "leads_quote_idx" ON "leads" USING btree ("org_id","quote_id");--> statement-breakpoint
CREATE INDEX "leads_web_recent_idx" ON "leads" USING btree ("org_id","created_at") WHERE "leads"."via_web_form";--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_enquiry_token_key" UNIQUE("enquiry_token");--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "automation_runs" AS PERMISSIVE FOR ALL TO "builderos_app" USING ("automation_runs"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid)) WITH CHECK ("automation_runs"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "automation_lookup" ON "automation_runs" AS PERMISSIVE FOR SELECT TO "builderos_lookup" USING (true);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "automations" AS PERMISSIVE FOR ALL TO "builderos_app" USING ("automations"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid)) WITH CHECK ("automations"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "lead_activities" AS PERMISSIVE FOR ALL TO "builderos_app" USING ("lead_activities"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid)) WITH CHECK ("lead_activities"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "leads" AS PERMISSIVE FOR ALL TO "builderos_app" USING ("leads"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid)) WITH CHECK ("leads"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "lead_lookup" ON "leads" AS PERMISSIVE FOR SELECT TO "builderos_lookup" USING (true);
--> statement-breakpoint
ALTER TABLE "leads" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "lead_activities" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "automations" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "automation_runs" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT UPDATE (enquiry_token) ON organizations TO builderos_app;--> statement-breakpoint
-- The lookup role can see just what the three public entry points match on: the enquiry form's token, an
-- unsubscribe token, and which companies have automation emails due. Everything else runs in the tenant.
GRANT SELECT (enquiry_token) ON organizations TO builderos_lookup;--> statement-breakpoint
GRANT SELECT (id, org_id, unsubscribe_token) ON leads TO builderos_lookup;--> statement-breakpoint
GRANT SELECT (org_id, status, next_at) ON automation_runs TO builderos_lookup;--> statement-breakpoint
CREATE FUNCTION app_enquiry_form_lookup(p_token text)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT o.id FROM public.organizations o WHERE o.enquiry_token = p_token AND o.deleted_at IS NULL
$$;--> statement-breakpoint
CREATE FUNCTION app_lead_unsubscribe_lookup(p_token text)
RETURNS TABLE (org_id uuid, lead_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT l.org_id, l.id FROM public.leads l WHERE l.unsubscribe_token = p_token
$$;--> statement-breakpoint
CREATE FUNCTION app_orgs_with_due_automations(p_now timestamptz)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT DISTINCT r.org_id FROM public.automation_runs r
  JOIN public.organizations o ON o.id = r.org_id
  WHERE r.status = 'active' AND r.next_at <= p_now AND o.deleted_at IS NULL
$$;--> statement-breakpoint
GRANT CREATE ON SCHEMA public TO builderos_lookup;--> statement-breakpoint
ALTER FUNCTION app_enquiry_form_lookup(text) OWNER TO builderos_lookup;--> statement-breakpoint
ALTER FUNCTION app_lead_unsubscribe_lookup(text) OWNER TO builderos_lookup;--> statement-breakpoint
ALTER FUNCTION app_orgs_with_due_automations(timestamptz) OWNER TO builderos_lookup;--> statement-breakpoint
REVOKE CREATE ON SCHEMA public FROM builderos_lookup;--> statement-breakpoint
REVOKE ALL ON FUNCTION app_enquiry_form_lookup(text) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION app_lead_unsubscribe_lookup(text) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION app_orgs_with_due_automations(timestamptz) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_enquiry_form_lookup(text) TO builderos_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_lead_unsubscribe_lookup(text) TO builderos_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_orgs_with_due_automations(timestamptz) TO builderos_app;
