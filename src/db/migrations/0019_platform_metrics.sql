-- Metrics role: owns the read-only functions behind the platform team's dashboard. NOLOGIN, no BYPASSRLS;
-- it reads only the columns granted below, through `platform_metrics` policies. Created like 0018's role.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'builderos_metrics') THEN
    CREATE ROLE builderos_metrics NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOINHERIT;
  ELSIF NOT pg_has_role(current_user, 'builderos_metrics', 'MEMBER WITH ADMIN OPTION') THEN
    RAISE EXCEPTION 'Role builderos_metrics exists but % has no ADMIN option on it', current_user
      USING HINT = format('As a superuser, run: GRANT builderos_metrics TO %I WITH ADMIN OPTION;', current_user);
  END IF;
  IF NOT pg_has_role(current_user, 'builderos_metrics', 'SET') THEN
    EXECUTE format('GRANT builderos_metrics TO %I WITH INHERIT FALSE, SET TRUE', current_user);
  END IF;
  IF NOT pg_has_role(current_user, 'builderos_billing', 'SET') THEN
    EXECUTE format('GRANT builderos_billing TO %I WITH INHERIT FALSE, SET TRUE', current_user);
  END IF;
END
$$;--> statement-breakpoint
CREATE TABLE "member_activity" (
	"org_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"day" date NOT NULL,
	"views" integer DEFAULT 1 NOT NULL,
	"sessions" integer DEFAULT 1 NOT NULL,
	"site_views" integer DEFAULT 0 NOT NULL,
	"first_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "member_activity_pkey" PRIMARY KEY("org_id","member_id","day"),
	CONSTRAINT "member_activity_views_range" CHECK ("member_activity"."views" between 0 and 1000000),
	CONSTRAINT "member_activity_sessions_range" CHECK ("member_activity"."sessions" between 0 and 100000),
	CONSTRAINT "member_activity_site_views_range" CHECK ("member_activity"."site_views" between 0 and "member_activity"."views")
);
--> statement-breakpoint
ALTER TABLE "member_activity" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "subscription_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"plan" "plan" NOT NULL,
	"status" text NOT NULL,
	"mrr_before_pence" integer NOT NULL,
	"mrr_after_pence" integer NOT NULL,
	CONSTRAINT "subscription_events_status" CHECK ("subscription_events"."status" ~ '^[a-z_]{1,30}$'),
	CONSTRAINT "subscription_events_mrr_range" CHECK ("subscription_events"."mrr_before_pence" between 0 and 100000000 and "subscription_events"."mrr_after_pence" between 0 and 100000000)
);
--> statement-breakpoint
ALTER TABLE "subscription_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "onboarding_tour_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "onboarding_hidden" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "onboarding_seen" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "mrr_pence" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "member_activity" ADD CONSTRAINT "member_activity_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_activity" ADD CONSTRAINT "member_activity_member_fk" FOREIGN KEY ("org_id","member_id") REFERENCES "public"."members"("org_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_events" ADD CONSTRAINT "subscription_events_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "member_activity_day_idx" ON "member_activity" USING btree ("day");--> statement-breakpoint
CREATE INDEX "subscription_events_at_idx" ON "subscription_events" USING btree ("at");--> statement-breakpoint
CREATE INDEX "subscription_events_org_idx" ON "subscription_events" USING btree ("org_id","at");--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_onboarding_seen_size" CHECK (cardinality("members"."onboarding_seen") <= 60);--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_mrr_range" CHECK ("organizations"."mrr_pence" between 0 and 100000000);--> statement-breakpoint
CREATE POLICY "platform_metrics" ON "invoices" AS PERMISSIVE FOR SELECT TO "builderos_metrics" USING (true);--> statement-breakpoint
CREATE POLICY "platform_metrics" ON "leads" AS PERMISSIVE FOR SELECT TO "builderos_metrics" USING (true);--> statement-breakpoint
CREATE POLICY "platform_metrics" ON "members" AS PERMISSIVE FOR SELECT TO "builderos_metrics" USING (true);--> statement-breakpoint
CREATE POLICY "platform_metrics" ON "organizations" AS PERMISSIVE FOR SELECT TO "builderos_metrics" USING (true);--> statement-breakpoint
CREATE POLICY "platform_metrics" ON "projects" AS PERMISSIVE FOR SELECT TO "builderos_metrics" USING (true);--> statement-breakpoint
CREATE POLICY "platform_metrics" ON "quote_versions" AS PERMISSIVE FOR SELECT TO "builderos_metrics" USING (true);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "member_activity" AS PERMISSIVE FOR ALL TO "builderos_app" USING ("member_activity"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid)) WITH CHECK ("member_activity"."org_id" = (select nullif(current_setting('app.org_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "platform_metrics" ON "member_activity" AS PERMISSIVE FOR SELECT TO "builderos_metrics" USING (true);--> statement-breakpoint
CREATE POLICY "billing_insert" ON "subscription_events" AS PERMISSIVE FOR INSERT TO "builderos_billing" WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "platform_metrics" ON "subscription_events" AS PERMISSIVE FOR SELECT TO "builderos_metrics" USING (true);--> statement-breakpoint
ALTER TABLE "member_activity" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "subscription_events" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
-- The app records activity (no deletes: rows go with the member or company) and never sees billing history.
REVOKE DELETE ON member_activity FROM builderos_app;--> statement-breakpoint
REVOKE ALL ON subscription_events FROM builderos_app;--> statement-breakpoint
GRANT INSERT ON subscription_events TO builderos_billing;--> statement-breakpoint
GRANT UPDATE (mrr_pence) ON organizations TO builderos_billing;--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO builderos_metrics;--> statement-breakpoint
GRANT SELECT (id, name, trading_name, created_at, plan, comped, trial_ends_at, subscription_status, cancel_at_period_end, mrr_pence, connect_charges_enabled, deleted_at) ON organizations TO builderos_metrics;--> statement-breakpoint
GRANT SELECT (org_id, id, active, created_at) ON members TO builderos_metrics;--> statement-breakpoint
GRANT SELECT (org_id, member_id, day, views, sessions, site_views, last_at) ON member_activity TO builderos_metrics;--> statement-breakpoint
GRANT SELECT (org_id, at, plan, status, mrr_before_pence, mrr_after_pence) ON subscription_events TO builderos_metrics;--> statement-breakpoint
GRANT SELECT (org_id, version_no, sent_at) ON quote_versions TO builderos_metrics;--> statement-breakpoint
GRANT SELECT (org_id, created_at) ON projects TO builderos_metrics;--> statement-breakpoint
GRANT SELECT (org_id, created_at) ON leads TO builderos_metrics;--> statement-breakpoint
GRANT SELECT (org_id, status, paid_on, total_pence, stripe_payment_id) ON invoices TO builderos_metrics;--> statement-breakpoint
-- Applying a subscription now also records what it pays us (MRR) and, when that changes, an event.
DROP FUNCTION app_billing_apply_subscription(uuid, text, text, public.plan, text, timestamptz, boolean);--> statement-breakpoint
CREATE FUNCTION app_billing_apply_subscription(p_org uuid, p_customer text, p_subscription text, p_plan public.plan, p_status text, p_period_end timestamptz, p_cancel boolean, p_monthly_pence integer)
RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_live boolean := p_status IN ('active', 'trialing', 'past_due');
  v_mrr integer := CASE WHEN p_status IN ('active', 'past_due') THEN greatest(0, least(coalesce(p_monthly_pence, 0), 100000000)) ELSE 0 END;
  v_before integer;
BEGIN
  SELECT o.mrr_pence INTO v_before FROM public.organizations o
  WHERE o.id = p_org
    AND (o.stripe_customer_id IS NULL OR o.stripe_customer_id = p_customer)
    AND (o.stripe_subscription_id IS NULL OR o.stripe_subscription_id = p_subscription OR v_live)
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  UPDATE public.organizations SET
    plan = CASE WHEN v_live THEN p_plan ELSE 'free'::public.plan END,
    stripe_customer_id = coalesce(stripe_customer_id, p_customer),
    stripe_subscription_id = p_subscription,
    subscription_status = p_status,
    current_period_end = p_period_end,
    cancel_at_period_end = p_cancel,
    mrr_pence = v_mrr,
    updated_at = now()
  WHERE id = p_org;
  IF v_before IS DISTINCT FROM v_mrr THEN
    INSERT INTO public.subscription_events (org_id, plan, status, mrr_before_pence, mrr_after_pence) VALUES (p_org, p_plan, p_status, v_before, v_mrr);
  END IF;
  RETURN true;
END
$$;--> statement-breakpoint
GRANT CREATE ON SCHEMA public TO builderos_billing;--> statement-breakpoint
ALTER FUNCTION app_billing_apply_subscription(uuid, text, text, public.plan, text, timestamptz, boolean, integer) OWNER TO builderos_billing;--> statement-breakpoint
REVOKE CREATE ON SCHEMA public FROM builderos_billing;--> statement-breakpoint
REVOKE ALL ON FUNCTION app_billing_apply_subscription(uuid, text, text, public.plan, text, timestamptz, boolean, integer) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_billing_apply_subscription(uuid, text, text, public.plan, text, timestamptz, boolean, integer) TO builderos_app;--> statement-breakpoint
-- Every company with its plan and how much it's used (counts only), for the platform dashboard.
CREATE FUNCTION app_platform_company_stats(p_today date)
RETURNS TABLE (
  id uuid, name text, created_at timestamptz, plan public.plan, comped boolean, trial_ends_at timestamptz,
  subscription_status text, cancel_at_period_end boolean, mrr_pence integer, online_payments boolean, deleted_at timestamptz,
  users integer, active_7d integer, active_30d integer, last_active_at timestamptz, views_30d integer, site_views_30d integer,
  quotes_sent_30d integer, quotes_sent_total integer, projects integer, leads_30d integer, paid_online_30d_pence bigint, paid_30d_pence bigint
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT o.id, coalesce(o.trading_name, o.name), o.created_at, o.plan, o.comped, o.trial_ends_at,
    o.subscription_status, o.cancel_at_period_end, o.mrr_pence, o.connect_charges_enabled, o.deleted_at,
    (SELECT count(*) FROM public.members m WHERE m.org_id = o.id AND m.active)::int,
    (SELECT count(DISTINCT a.member_id) FROM public.member_activity a WHERE a.org_id = o.id AND a.day > p_today - 7)::int,
    (SELECT count(DISTINCT a.member_id) FROM public.member_activity a WHERE a.org_id = o.id AND a.day > p_today - 30)::int,
    (SELECT max(a.last_at) FROM public.member_activity a WHERE a.org_id = o.id),
    (SELECT coalesce(sum(a.views), 0) FROM public.member_activity a WHERE a.org_id = o.id AND a.day > p_today - 30)::int,
    (SELECT coalesce(sum(a.site_views), 0) FROM public.member_activity a WHERE a.org_id = o.id AND a.day > p_today - 30)::int,
    (SELECT count(*) FROM public.quote_versions v WHERE v.org_id = o.id AND v.version_no = 1 AND v.sent_at > p_today - 30)::int,
    (SELECT count(*) FROM public.quote_versions v WHERE v.org_id = o.id AND v.version_no = 1)::int,
    (SELECT count(*) FROM public.projects p WHERE p.org_id = o.id)::int,
    (SELECT count(*) FROM public.leads l WHERE l.org_id = o.id AND l.created_at > p_today - 30)::int,
    (SELECT coalesce(sum(i.total_pence), 0) FROM public.invoices i WHERE i.org_id = o.id AND i.status = 'paid' AND i.stripe_payment_id IS NOT NULL AND i.paid_on > p_today - 30)::bigint,
    (SELECT coalesce(sum(i.total_pence), 0) FROM public.invoices i WHERE i.org_id = o.id AND i.status = 'paid' AND i.paid_on > p_today - 30)::bigint
  FROM public.organizations o
  ORDER BY o.created_at DESC
  LIMIT 5000
$$;--> statement-breakpoint
-- Per day: people and companies who used the app, views and sessions, and the people active in the
-- 7 and 30 days up to it (weekly and monthly actives). At most 400 days.
CREATE FUNCTION app_platform_daily_activity(p_from date, p_to date)
RETURNS TABLE (day date, active_users integer, active_companies integer, views integer, sessions integer, site_views integer, wau integer, mau integer)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT d.day,
    (SELECT count(*) FROM public.member_activity a WHERE a.day = d.day)::int,
    (SELECT count(DISTINCT a.org_id) FROM public.member_activity a WHERE a.day = d.day)::int,
    (SELECT coalesce(sum(a.views), 0) FROM public.member_activity a WHERE a.day = d.day)::int,
    (SELECT coalesce(sum(a.sessions), 0) FROM public.member_activity a WHERE a.day = d.day)::int,
    (SELECT coalesce(sum(a.site_views), 0) FROM public.member_activity a WHERE a.day = d.day)::int,
    (SELECT count(DISTINCT (a.org_id, a.member_id)) FROM public.member_activity a WHERE a.day BETWEEN d.day - 6 AND d.day)::int,
    (SELECT count(DISTINCT (a.org_id, a.member_id)) FROM public.member_activity a WHERE a.day BETWEEN d.day - 29 AND d.day)::int
  FROM (SELECT g::date AS day FROM generate_series(greatest(p_from, p_to - 400), p_to, interval '1 day') g) d
  ORDER BY d.day
$$;--> statement-breakpoint
-- Changes to what companies pay us since a time, oldest first.
CREATE FUNCTION app_platform_subscription_events(p_since timestamptz)
RETURNS TABLE (org_id uuid, at timestamptz, plan public.plan, status text, mrr_before_pence integer, mrr_after_pence integer)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT e.org_id, e.at, e.plan, e.status, e.mrr_before_pence, e.mrr_after_pence
  FROM public.subscription_events e WHERE e.at >= p_since ORDER BY e.at LIMIT 20000
$$;--> statement-breakpoint
-- New team members (logins) per UK day since a date.
CREATE FUNCTION app_platform_user_signups(p_from date)
RETURNS TABLE (day date, users integer)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT (m.created_at AT TIME ZONE 'Europe/London')::date AS day, count(*)::int
  FROM public.members m WHERE m.created_at >= (p_from::timestamp AT TIME ZONE 'Europe/London')
  GROUP BY 1 ORDER BY 1
$$;--> statement-breakpoint
GRANT CREATE ON SCHEMA public TO builderos_metrics;--> statement-breakpoint
ALTER FUNCTION app_platform_company_stats(date) OWNER TO builderos_metrics;--> statement-breakpoint
ALTER FUNCTION app_platform_daily_activity(date, date) OWNER TO builderos_metrics;--> statement-breakpoint
ALTER FUNCTION app_platform_subscription_events(timestamptz) OWNER TO builderos_metrics;--> statement-breakpoint
ALTER FUNCTION app_platform_user_signups(date) OWNER TO builderos_metrics;--> statement-breakpoint
REVOKE CREATE ON SCHEMA public FROM builderos_metrics;--> statement-breakpoint
REVOKE ALL ON FUNCTION app_platform_company_stats(date) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION app_platform_daily_activity(date, date) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION app_platform_subscription_events(timestamptz) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION app_platform_user_signups(date) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_platform_company_stats(date) TO builderos_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_platform_daily_activity(date, date) TO builderos_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_platform_subscription_events(timestamptz) TO builderos_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_platform_user_signups(date) TO builderos_app;