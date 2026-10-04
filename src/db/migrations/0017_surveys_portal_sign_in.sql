CREATE TYPE "public"."portal_code_kind" AS ENUM('code', 'link');--> statement-breakpoint
CREATE TYPE "public"."survey_booked_by" AS ENUM('client', 'office');--> statement-breakpoint
CREATE TYPE "public"."survey_booking_status" AS ENUM('booked', 'cancelled');--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE 'survey_booked';--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE 'survey_cancelled';--> statement-breakpoint
CREATE TABLE "portal_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"access_id" uuid NOT NULL,
	"kind" "portal_code_kind" NOT NULL,
	"secret_hash" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "portal_codes_hash_format" CHECK ("portal_codes"."secret_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "portal_codes_attempts_range" CHECK ("portal_codes"."attempts" between 0 and 10)
);
--> statement-breakpoint
ALTER TABLE "portal_codes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "portal_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"access_id" uuid NOT NULL,
	"secret_hash" text NOT NULL,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "portal_sessions_secret_hash_unique" UNIQUE("secret_hash"),
	CONSTRAINT "portal_sessions_hash_format" CHECK ("portal_sessions"."secret_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "portal_sessions_user_agent_len" CHECK (char_length("portal_sessions"."user_agent") between 0 and 300)
);
--> statement-breakpoint
ALTER TABLE "portal_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "survey_bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"member_id" uuid,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" "survey_booking_status" DEFAULT 'booked' NOT NULL,
	"booked_by" "survey_booked_by" NOT NULL,
	"reminder_sent_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "survey_bookings_times" CHECK ("survey_bookings"."ends_at" > "survey_bookings"."starts_at" and "survey_bookings"."ends_at" <= "survey_bookings"."starts_at" + interval '8 hours'),
	CONSTRAINT "survey_bookings_cancelled" CHECK (("survey_bookings"."status" = 'cancelled') = ("survey_bookings"."cancelled_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "survey_bookings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "survey_hours" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"weekday" integer NOT NULL,
	"start_minute" integer NOT NULL,
	"end_minute" integer NOT NULL,
	CONSTRAINT "survey_hours_weekday_range" CHECK ("survey_hours"."weekday" between 1 and 7),
	CONSTRAINT "survey_hours_window" CHECK ("survey_hours"."start_minute" >= 0 and "survey_hours"."end_minute" <= 1440 and "survey_hours"."start_minute" < "survey_hours"."end_minute")
);
--> statement-breakpoint
ALTER TABLE "survey_hours" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "survey_settings" (
	"org_id" uuid PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"visit_minutes" integer DEFAULT 60 NOT NULL,
	"buffer_minutes" integer DEFAULT 30 NOT NULL,
	"min_notice_hours" integer DEFAULT 24 NOT NULL,
	"max_days_ahead" integer DEFAULT 21 NOT NULL,
	"postcodes" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "survey_settings_visit_range" CHECK ("survey_settings"."visit_minutes" between 15 and 480),
	CONSTRAINT "survey_settings_buffer_range" CHECK ("survey_settings"."buffer_minutes" between 0 and 240),
	CONSTRAINT "survey_settings_notice_range" CHECK ("survey_settings"."min_notice_hours" between 0 and 336),
	CONSTRAINT "survey_settings_ahead_range" CHECK ("survey_settings"."max_days_ahead" between 1 and 90),
	CONSTRAINT "survey_settings_postcodes_max" CHECK (cardinality("survey_settings"."postcodes") <= 100)
);
--> statement-breakpoint
ALTER TABLE "survey_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "portal_sign_in" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "portal_codes" ADD CONSTRAINT "portal_codes_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_codes" ADD CONSTRAINT "portal_codes_access_fk" FOREIGN KEY ("org_id","access_id") REFERENCES "public"."portal_access"("org_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_sessions" ADD CONSTRAINT "portal_sessions_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_sessions" ADD CONSTRAINT "portal_sessions_access_fk" FOREIGN KEY ("org_id","access_id") REFERENCES "public"."portal_access"("org_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_bookings" ADD CONSTRAINT "survey_bookings_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_bookings" ADD CONSTRAINT "survey_bookings_lead_fk" FOREIGN KEY ("org_id","lead_id") REFERENCES "public"."leads"("org_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_bookings" ADD CONSTRAINT "survey_bookings_member_fk" FOREIGN KEY ("org_id","member_id") REFERENCES "public"."members"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_hours" ADD CONSTRAINT "survey_hours_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_hours" ADD CONSTRAINT "survey_hours_member_fk" FOREIGN KEY ("org_id","member_id") REFERENCES "public"."members"("org_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_settings" ADD CONSTRAINT "survey_settings_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "portal_codes_access_idx" ON "portal_codes" USING btree ("org_id","access_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "portal_codes_link_hash" ON "portal_codes" USING btree ("secret_hash") WHERE "portal_codes"."kind" = 'link';--> statement-breakpoint
CREATE INDEX "portal_sessions_access_idx" ON "portal_sessions" USING btree ("org_id","access_id");--> statement-breakpoint
CREATE UNIQUE INDEX "survey_bookings_one_live_per_lead" ON "survey_bookings" USING btree ("org_id","lead_id") WHERE "survey_bookings"."status" = 'booked';--> statement-breakpoint
CREATE INDEX "survey_bookings_member_time_idx" ON "survey_bookings" USING btree ("org_id","member_id","starts_at");--> statement-breakpoint
CREATE INDEX "survey_bookings_reminder_idx" ON "survey_bookings" USING btree ("starts_at") WHERE "survey_bookings"."status" = 'booked' and "survey_bookings"."reminder_sent_at" is null;--> statement-breakpoint
CREATE INDEX "survey_hours_member_idx" ON "survey_hours" USING btree ("org_id","member_id");--> statement-breakpoint
CREATE INDEX "clients_email_lower_idx" ON "clients" USING btree (lower("email"));--> statement-breakpoint
CREATE POLICY "portal_email_lookup" ON "clients" AS PERMISSIVE FOR SELECT TO "builderos_lookup" USING (true);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "portal_codes" AS PERMISSIVE FOR ALL TO "builderos_app" USING ("portal_codes"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid)) WITH CHECK ("portal_codes"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "portal_sessions" AS PERMISSIVE FOR ALL TO "builderos_app" USING ("portal_sessions"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid)) WITH CHECK ("portal_sessions"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "survey_bookings" AS PERMISSIVE FOR ALL TO "builderos_app" USING ("survey_bookings"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid)) WITH CHECK ("survey_bookings"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "survey_lookup" ON "survey_bookings" AS PERMISSIVE FOR SELECT TO "builderos_lookup" USING (true);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "survey_hours" AS PERMISSIVE FOR ALL TO "builderos_app" USING ("survey_hours"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid)) WITH CHECK ("survey_hours"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "survey_settings" AS PERMISSIVE FOR ALL TO "builderos_app" USING ("survey_settings"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid)) WITH CHECK ("survey_settings"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid));--> statement-breakpoint
-- ── Custom SQL ───────────────────────────────────────────────────────────────
-- Visits already booked by hand become bookings (with their lead's owner as surveyor). Done before RLS is
-- forced on the new table; clashing visits for one person are left as they are on the lead.
INSERT INTO "survey_bookings" ("org_id", "lead_id", "member_id", "starts_at", "ends_at", "booked_by")
SELECT l."org_id", l."id", l."owner_member_id", l."visit_at", l."visit_at" + interval '1 hour', 'office'
FROM "leads" l
WHERE l."visit_at" IS NOT NULL AND l."visit_at" > now() - interval '1 day' AND l."stage" NOT IN ('won', 'lost')
ON CONFLICT DO NOTHING;--> statement-breakpoint
-- One person can't be in two places: no two live bookings of theirs may overlap.
CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint
ALTER TABLE "survey_bookings" ADD CONSTRAINT "survey_bookings_no_overlap"
  EXCLUDE USING gist ("org_id" WITH =, "member_id" WITH =, tstzrange("starts_at", "ends_at") WITH &&)
  WHERE ("status" = 'booked' AND "member_id" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "survey_settings" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "survey_hours" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "survey_bookings" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "portal_sessions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "portal_codes" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT UPDATE (portal_sign_in) ON organizations TO builderos_app;--> statement-breakpoint
-- Bookings are cancelled, never deleted (they cascade with their lead).
REVOKE DELETE ON survey_bookings FROM builderos_app;--> statement-breakpoint
-- Codes are used up, never edited otherwise.
REVOKE UPDATE ON portal_codes FROM builderos_app;--> statement-breakpoint
GRANT UPDATE (attempts, used_at) ON portal_codes TO builderos_app;--> statement-breakpoint
REVOKE UPDATE ON portal_sessions FROM builderos_app;--> statement-breakpoint
GRANT UPDATE (last_seen_at) ON portal_sessions TO builderos_app;--> statement-breakpoint
-- ── Lookups ──────────────────────────────────────────────────────────────────
-- "Find my portal" by email, and which companies have survey reminders due. Each returns ids only.
GRANT SELECT (id, org_id, email, archived_at) ON clients TO builderos_lookup;--> statement-breakpoint
GRANT SELECT (org_id, status, starts_at, reminder_sent_at) ON survey_bookings TO builderos_lookup;--> statement-breakpoint
CREATE FUNCTION app_portal_by_email(p_email text)
RETURNS TABLE (access_id uuid, org_id uuid, client_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT p.id, p.org_id, p.client_id
  FROM public.portal_access p
  JOIN public.clients c ON c.org_id = p.org_id AND c.id = p.client_id
  JOIN public.organizations o ON o.id = p.org_id
  WHERE lower(c.email) = lower(p_email) AND p.revoked_at IS NULL AND c.archived_at IS NULL AND o.deleted_at IS NULL
  LIMIT 20
$$;--> statement-breakpoint
CREATE FUNCTION app_orgs_with_due_survey_reminders(p_from timestamptz, p_to timestamptz)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT DISTINCT b.org_id FROM public.survey_bookings b
  JOIN public.organizations o ON o.id = b.org_id
  WHERE b.status = 'booked' AND b.reminder_sent_at IS NULL AND b.starts_at >= p_from AND b.starts_at < p_to AND o.deleted_at IS NULL
$$;--> statement-breakpoint
GRANT CREATE ON SCHEMA public TO builderos_lookup;--> statement-breakpoint
ALTER FUNCTION app_portal_by_email(text) OWNER TO builderos_lookup;--> statement-breakpoint
ALTER FUNCTION app_orgs_with_due_survey_reminders(timestamptz, timestamptz) OWNER TO builderos_lookup;--> statement-breakpoint
REVOKE CREATE ON SCHEMA public FROM builderos_lookup;--> statement-breakpoint
REVOKE ALL ON FUNCTION app_portal_by_email(text) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION app_orgs_with_due_survey_reminders(timestamptz, timestamptz) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_portal_by_email(text) TO builderos_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_orgs_with_due_survey_reminders(timestamptz, timestamptz) TO builderos_app;
