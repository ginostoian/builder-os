CREATE TYPE "public"."quote_event_kind" AS ENUM('sent', 'viewed', 'commented', 'replied', 'accepted', 'declined', 'revised');--> statement-breakpoint
CREATE TABLE "portal_access" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"last_viewed_at" timestamp with time zone,
	CONSTRAINT "portal_access_token_unique" UNIQUE("token"),
	CONSTRAINT "portal_access_org_id_id_key" UNIQUE("org_id","id"),
	CONSTRAINT "portal_access_token_format" CHECK ("portal_access"."token" ~ '^[A-Za-z0-9_-]{43}$')
);
--> statement-breakpoint
ALTER TABLE "portal_access" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quote_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"quote_id" uuid NOT NULL,
	"version_id" uuid NOT NULL,
	"line_id" uuid,
	"author_kind" text NOT NULL,
	"author_name" text NOT NULL,
	"member_id" uuid,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quote_comments_author_kind" CHECK ("quote_comments"."author_kind" in ('client', 'staff')),
	CONSTRAINT "quote_comments_author_name_len" CHECK (char_length("quote_comments"."author_name") between 1 and 200),
	CONSTRAINT "quote_comments_body_len" CHECK (char_length("quote_comments"."body") between 1 and 2000)
);
--> statement-breakpoint
ALTER TABLE "quote_comments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quote_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"quote_id" uuid NOT NULL,
	"version_id" uuid NOT NULL,
	"decision" text NOT NULL,
	"full_name" text NOT NULL,
	"signature" text,
	"reason" text,
	"content_hash" text NOT NULL,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quote_decisions_version_key" UNIQUE("org_id","version_id"),
	CONSTRAINT "quote_decisions_kind" CHECK ("quote_decisions"."decision" in ('accepted', 'declined')),
	CONSTRAINT "quote_decisions_signed" CHECK ("quote_decisions"."decision" = 'declined' or "quote_decisions"."signature" is not null),
	CONSTRAINT "quote_decisions_full_name_len" CHECK (char_length("quote_decisions"."full_name") between 1 and 200),
	CONSTRAINT "quote_decisions_signature_len" CHECK (char_length("quote_decisions"."signature") between 1 and 200),
	CONSTRAINT "quote_decisions_reason_len" CHECK (char_length("quote_decisions"."reason") between 0 and 2000),
	CONSTRAINT "quote_decisions_hash_format" CHECK ("quote_decisions"."content_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "quote_decisions_ip_len" CHECK (char_length("quote_decisions"."ip") between 0 and 64),
	CONSTRAINT "quote_decisions_user_agent_len" CHECK (char_length("quote_decisions"."user_agent") between 0 and 500)
);
--> statement-breakpoint
ALTER TABLE "quote_decisions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quote_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"quote_id" uuid NOT NULL,
	"version_id" uuid,
	"kind" "quote_event_kind" NOT NULL,
	"actor" text NOT NULL,
	"member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quote_events_actor" CHECK ("quote_events"."actor" in ('client', 'staff'))
);
--> statement-breakpoint
ALTER TABLE "quote_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quote_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"quote_id" uuid NOT NULL,
	"version_no" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"content_hash" text NOT NULL,
	"total_pence" integer NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_by_member_id" uuid,
	CONSTRAINT "quote_versions_org_id_id_key" UNIQUE("org_id","id"),
	CONSTRAINT "quote_versions_quote_version_key" UNIQUE("org_id","quote_id","version_no"),
	CONSTRAINT "quote_versions_version_positive" CHECK ("quote_versions"."version_no" > 0),
	CONSTRAINT "quote_versions_snapshot_object" CHECK (jsonb_typeof("quote_versions"."snapshot") = 'object'),
	CONSTRAINT "quote_versions_hash_format" CHECK ("quote_versions"."content_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
ALTER TABLE "quote_versions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "portal_access" ADD CONSTRAINT "portal_access_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_access" ADD CONSTRAINT "portal_access_client_fk" FOREIGN KEY ("org_id","client_id") REFERENCES "public"."clients"("org_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_comments" ADD CONSTRAINT "quote_comments_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_comments" ADD CONSTRAINT "quote_comments_quote_fk" FOREIGN KEY ("org_id","quote_id") REFERENCES "public"."quotes"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_comments" ADD CONSTRAINT "quote_comments_version_fk" FOREIGN KEY ("org_id","version_id") REFERENCES "public"."quote_versions"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_comments" ADD CONSTRAINT "quote_comments_member_fk" FOREIGN KEY ("org_id","member_id") REFERENCES "public"."members"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_decisions" ADD CONSTRAINT "quote_decisions_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_decisions" ADD CONSTRAINT "quote_decisions_quote_fk" FOREIGN KEY ("org_id","quote_id") REFERENCES "public"."quotes"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_decisions" ADD CONSTRAINT "quote_decisions_version_fk" FOREIGN KEY ("org_id","version_id") REFERENCES "public"."quote_versions"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_events" ADD CONSTRAINT "quote_events_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_events" ADD CONSTRAINT "quote_events_quote_fk" FOREIGN KEY ("org_id","quote_id") REFERENCES "public"."quotes"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_events" ADD CONSTRAINT "quote_events_version_fk" FOREIGN KEY ("org_id","version_id") REFERENCES "public"."quote_versions"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_versions" ADD CONSTRAINT "quote_versions_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_versions" ADD CONSTRAINT "quote_versions_quote_fk" FOREIGN KEY ("org_id","quote_id") REFERENCES "public"."quotes"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_versions" ADD CONSTRAINT "quote_versions_member_fk" FOREIGN KEY ("org_id","sent_by_member_id") REFERENCES "public"."members"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "portal_access_one_active_per_client" ON "portal_access" USING btree ("org_id","client_id") WHERE "portal_access"."revoked_at" is null;--> statement-breakpoint
CREATE INDEX "quote_comments_quote_idx" ON "quote_comments" USING btree ("org_id","quote_id","created_at");--> statement-breakpoint
CREATE INDEX "quote_events_quote_idx" ON "quote_events" USING btree ("org_id","quote_id","created_at");--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "portal_access" AS PERMISSIVE FOR ALL TO "builderos_app" USING ("portal_access"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid)) WITH CHECK ("portal_access"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "portal_lookup" ON "portal_access" AS PERMISSIVE FOR SELECT TO "builderos_lookup" USING (true);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "quote_comments" AS PERMISSIVE FOR ALL TO "builderos_app" USING ("quote_comments"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid)) WITH CHECK ("quote_comments"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "quote_decisions" AS PERMISSIVE FOR ALL TO "builderos_app" USING ("quote_decisions"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid)) WITH CHECK ("quote_decisions"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "quote_events" AS PERMISSIVE FOR ALL TO "builderos_app" USING ("quote_events"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid)) WITH CHECK ("quote_events"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "quote_versions" AS PERMISSIVE FOR ALL TO "builderos_app" USING ("quote_versions"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid)) WITH CHECK ("quote_versions"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid));--> statement-breakpoint
-- ── RLS applies to the owner too (see 0002) ──────────────────────────────────
ALTER TABLE "portal_access" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "quote_versions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "quote_events" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "quote_comments" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "quote_decisions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
-- ── Records are append-only for the app ──────────────────────────────────────
-- What a client was sent, what they said and what they signed can't be edited or removed by the app.
-- (Default privileges from 0002 granted full DML on these new tables; take back what they mustn't have.)
REVOKE UPDATE, DELETE ON quote_versions, quote_events, quote_comments, quote_decisions FROM builderos_app;--> statement-breakpoint
-- Portal links are revoked (revoked_at) or touched (last_viewed_at), never deleted or re-pointed.
REVOKE UPDATE, DELETE ON portal_access FROM builderos_app;--> statement-breakpoint
GRANT UPDATE (revoked_at, last_viewed_at) ON portal_access TO builderos_app;--> statement-breakpoint
-- ── Portal lookup ────────────────────────────────────────────────────────────
-- The public portal has no session, so RLS hides everything until we know the company. This answers only
-- "which company and client does this active token belong to", running as builderos_lookup (see 0004/0005).
GRANT SELECT (id, org_id, client_id, token, revoked_at) ON portal_access TO builderos_lookup;--> statement-breakpoint
CREATE FUNCTION app_portal_lookup(p_token text)
RETURNS TABLE (access_id uuid, org_id uuid, client_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT p.id, p.org_id, p.client_id FROM public.portal_access p WHERE p.token = p_token AND p.revoked_at IS NULL
$$;--> statement-breakpoint
GRANT CREATE ON SCHEMA public TO builderos_lookup;--> statement-breakpoint
ALTER FUNCTION app_portal_lookup(text) OWNER TO builderos_lookup;--> statement-breakpoint
REVOKE CREATE ON SCHEMA public FROM builderos_lookup;--> statement-breakpoint
REVOKE ALL ON FUNCTION app_portal_lookup(text) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_portal_lookup(text) TO builderos_app;
