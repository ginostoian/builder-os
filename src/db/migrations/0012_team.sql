CREATE TYPE "public"."worker_kind" AS ENUM('employee', 'subcontractor');--> statement-breakpoint
CREATE TABLE "site_visits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"worker_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"checked_in_at" timestamp with time zone DEFAULT now() NOT NULL,
	"checked_out_at" timestamp with time zone,
	"in_lat" numeric(9, 6),
	"in_lng" numeric(9, 6),
	"out_lat" numeric(9, 6),
	"out_lng" numeric(9, 6),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "site_visits_out_after_in" CHECK ("site_visits"."checked_out_at" is null or "site_visits"."checked_out_at" >= "site_visits"."checked_in_at"),
	CONSTRAINT "site_visits_lat" CHECK ("site_visits"."in_lat" is null or "site_visits"."in_lat" between -90 and 90),
	CONSTRAINT "site_visits_lng" CHECK ("site_visits"."in_lng" is null or "site_visits"."in_lng" between -180 and 180)
);
--> statement-breakpoint
ALTER TABLE "site_visits" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "worker_certificates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"worker_id" uuid NOT NULL,
	"name" text NOT NULL,
	"reference" text,
	"expires_on" date,
	"reminded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "worker_certificates_name_len" CHECK (char_length("worker_certificates"."name") between 1 and 200),
	CONSTRAINT "worker_certificates_reference_len" CHECK (char_length("worker_certificates"."reference") between 1 and 50)
);
--> statement-breakpoint
ALTER TABLE "worker_certificates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "workers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"member_id" uuid,
	"name" text NOT NULL,
	"kind" "worker_kind" DEFAULT 'employee' NOT NULL,
	"trade" text,
	"phone" text,
	"email" text,
	"day_rate_pence" integer,
	"started_on" date,
	"emergency_name" text,
	"emergency_phone" text,
	"notes" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workers_org_id_id_key" UNIQUE("org_id","id"),
	CONSTRAINT "workers_name_len" CHECK (char_length("workers"."name") between 1 and 200),
	CONSTRAINT "workers_trade_len" CHECK (char_length("workers"."trade") between 1 and 50),
	CONSTRAINT "workers_phone_len" CHECK (char_length("workers"."phone") between 1 and 32),
	CONSTRAINT "workers_email_len" CHECK (char_length("workers"."email") between 1 and 254),
	CONSTRAINT "workers_emergency_name_len" CHECK (char_length("workers"."emergency_name") between 1 and 200),
	CONSTRAINT "workers_emergency_phone_len" CHECK (char_length("workers"."emergency_phone") between 1 and 32),
	CONSTRAINT "workers_notes_len" CHECK (char_length("workers"."notes") between 0 and 2000),
	CONSTRAINT "workers_day_rate_range" CHECK ("workers"."day_rate_pence" between 0 and 1000000000)
);
--> statement-breakpoint
ALTER TABLE "workers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "project_tasks" ADD COLUMN "worker_id" uuid;--> statement-breakpoint
ALTER TABLE "site_visits" ADD CONSTRAINT "site_visits_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_visits" ADD CONSTRAINT "site_visits_worker_fk" FOREIGN KEY ("org_id","worker_id") REFERENCES "public"."workers"("org_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_visits" ADD CONSTRAINT "site_visits_project_fk" FOREIGN KEY ("org_id","project_id") REFERENCES "public"."projects"("org_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker_certificates" ADD CONSTRAINT "worker_certificates_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker_certificates" ADD CONSTRAINT "worker_certificates_worker_fk" FOREIGN KEY ("org_id","worker_id") REFERENCES "public"."workers"("org_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workers" ADD CONSTRAINT "workers_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workers" ADD CONSTRAINT "workers_member_fk" FOREIGN KEY ("org_id","member_id") REFERENCES "public"."members"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "site_visits_one_open" ON "site_visits" USING btree ("org_id","worker_id") WHERE "site_visits"."checked_out_at" is null;--> statement-breakpoint
CREATE INDEX "site_visits_worker_idx" ON "site_visits" USING btree ("org_id","worker_id","checked_in_at");--> statement-breakpoint
CREATE INDEX "worker_certificates_expiry_idx" ON "worker_certificates" USING btree ("org_id","expires_on");--> statement-breakpoint
CREATE UNIQUE INDEX "workers_one_per_member" ON "workers" USING btree ("org_id","member_id") WHERE "workers"."member_id" is not null;--> statement-breakpoint
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_worker_fk" FOREIGN KEY ("org_id","worker_id") REFERENCES "public"."workers"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_tasks_worker_idx" ON "project_tasks" USING btree ("org_id","worker_id");--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "site_visits" AS PERMISSIVE FOR ALL TO "builderos_app" USING ("site_visits"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid)) WITH CHECK ("site_visits"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "worker_certificates" AS PERMISSIVE FOR ALL TO "builderos_app" USING ("worker_certificates"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid)) WITH CHECK ("worker_certificates"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "cert_lookup" ON "worker_certificates" AS PERMISSIVE FOR SELECT TO "builderos_lookup" USING (true);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "workers" AS PERMISSIVE FOR ALL TO "builderos_app" USING ("workers"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid)) WITH CHECK ("workers"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "cert_lookup" ON "workers" AS PERMISSIVE FOR SELECT TO "builderos_lookup" USING (true);--> statement-breakpoint
-- ── RLS applies to the owner too (see 0002) ──────────────────────────────────
ALTER TABLE "workers" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "worker_certificates" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "site_visits" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
-- ── Everyone with a login is on the team ─────────────────────────────────────
-- Existing members get a worker (archived if they've left), and tasks given to a member move to their
-- worker. New members get one when they join (src/auth/clerk-sync.ts).
INSERT INTO workers (org_id, member_id, name, email, archived_at)
SELECT m.org_id, m.id, m.name, m.email, CASE WHEN m.active THEN NULL ELSE now() END FROM members m;--> statement-breakpoint
UPDATE project_tasks t SET worker_id = w.id FROM workers w
WHERE w.org_id = t.org_id AND w.member_id = t.assignee_member_id AND t.assignee_member_id IS NOT NULL;--> statement-breakpoint
-- ── Certificate reminder lookup ──────────────────────────────────────────────
-- The daily job has no session: this says which companies have certificates expiring by a date that
-- haven't been reminded about yet, and nothing else. The work then runs inside each company's tenant.
GRANT SELECT (org_id, worker_id, expires_on, reminded_at) ON worker_certificates TO builderos_lookup;--> statement-breakpoint
GRANT SELECT (id, org_id, archived_at) ON workers TO builderos_lookup;--> statement-breakpoint
CREATE FUNCTION app_orgs_with_expiring_certificates(p_until date)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT DISTINCT c.org_id FROM public.worker_certificates c
  JOIN public.workers w ON w.org_id = c.org_id AND w.id = c.worker_id
  JOIN public.organizations o ON o.id = c.org_id
  WHERE c.expires_on <= p_until AND c.reminded_at IS NULL AND w.archived_at IS NULL AND o.deleted_at IS NULL
$$;--> statement-breakpoint
GRANT CREATE ON SCHEMA public TO builderos_lookup;--> statement-breakpoint
ALTER FUNCTION app_orgs_with_expiring_certificates(date) OWNER TO builderos_lookup;--> statement-breakpoint
REVOKE CREATE ON SCHEMA public FROM builderos_lookup;--> statement-breakpoint
REVOKE ALL ON FUNCTION app_orgs_with_expiring_certificates(date) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_orgs_with_expiring_certificates(date) TO builderos_app;
