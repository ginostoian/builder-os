-- Billing role: owns the functions that change a company's plan, Stripe ids, trial and complimentary flag.
-- NOLOGIN, no BYPASSRLS; it reaches organizations only through the `billing_access` policy and the column
-- grants below. Created like builderos_lookup (0004).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'builderos_billing') THEN
    CREATE ROLE builderos_billing NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOINHERIT;
  ELSIF NOT pg_has_role(current_user, 'builderos_billing', 'MEMBER WITH ADMIN OPTION') THEN
    RAISE EXCEPTION 'Role builderos_billing exists but % has no ADMIN option on it', current_user
      USING HINT = format('As a superuser, run: GRANT builderos_billing TO %I WITH ADMIN OPTION;', current_user);
  END IF;
  -- Postgres 16+ doesn't let a role's creator act as it by default; handing it the functions below needs to.
  IF NOT pg_has_role(current_user, 'builderos_billing', 'SET') THEN
    EXECUTE format('GRANT builderos_billing TO %I WITH INHERIT FALSE, SET TRUE', current_user);
  END IF;
END
$$;--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE 'invoice_paid';--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "stripe_payment_id" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "trial_ends_at" timestamp with time zone DEFAULT now() + interval '14 days';--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "comped" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "stripe_subscription_id" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "subscription_status" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "current_period_end" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "cancel_at_period_end" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "connect_charges_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "connect_details_submitted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_stripe_payment_key" UNIQUE("stripe_payment_id");--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_stripe_customer_key" UNIQUE("stripe_customer_id");--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_connect_account_key" UNIQUE("connect_account_id");--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_stripe_subscription_key" UNIQUE("stripe_subscription_id");--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_subscription_status" CHECK ("organizations"."subscription_status" is null or "organizations"."subscription_status" ~ '^[a-z_]{1,30}$');--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_stripe_ids" CHECK (("organizations"."stripe_customer_id" is null or "organizations"."stripe_customer_id" ~ '^cus_[A-Za-z0-9]+$') and ("organizations"."stripe_subscription_id" is null or "organizations"."stripe_subscription_id" ~ '^sub_[A-Za-z0-9]+$') and ("organizations"."connect_account_id" is null or "organizations"."connect_account_id" ~ '^acct_[A-Za-z0-9]+$'));--> statement-breakpoint
CREATE POLICY "billing_access" ON "organizations" AS PERMISSIVE FOR ALL TO "builderos_billing" USING (true) WITH CHECK (true);--> statement-breakpoint
-- ── Custom SQL ───────────────────────────────────────────────────────────────
GRANT USAGE ON SCHEMA public TO builderos_billing;--> statement-breakpoint
GRANT SELECT ON organizations TO builderos_billing;--> statement-breakpoint
GRANT UPDATE (plan, comped, trial_ends_at, stripe_customer_id, stripe_subscription_id, subscription_status, current_period_end, cancel_at_period_end, connect_account_id, connect_charges_enabled, connect_details_submitted, updated_at) ON organizations TO builderos_billing;--> statement-breakpoint
-- The app records how an invoice was paid online, nothing else about Stripe.
GRANT UPDATE (stripe_payment_id) ON invoices TO builderos_app;--> statement-breakpoint
-- Stripe customer for our subscription billing. Set once; never re-pointed.
CREATE FUNCTION app_billing_set_customer(p_org uuid, p_customer text)
RETURNS boolean
LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
  WITH u AS (
    UPDATE public.organizations SET stripe_customer_id = p_customer, updated_at = now()
    WHERE id = p_org AND (stripe_customer_id IS NULL OR stripe_customer_id = p_customer)
    RETURNING 1
  ) SELECT count(*) > 0 FROM u
$$;--> statement-breakpoint
-- A subscription's current state, as fetched from Stripe. Only for the company's own customer. An old
-- subscription that has ended can't overwrite a newer one.
CREATE FUNCTION app_billing_apply_subscription(p_org uuid, p_customer text, p_subscription text, p_plan public.plan, p_status text, p_period_end timestamptz, p_cancel boolean)
RETURNS boolean
LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
  WITH u AS (
    UPDATE public.organizations SET
      plan = CASE WHEN p_status IN ('active', 'trialing', 'past_due') THEN p_plan ELSE 'free'::public.plan END,
      stripe_customer_id = coalesce(stripe_customer_id, p_customer),
      stripe_subscription_id = p_subscription,
      subscription_status = p_status,
      current_period_end = p_period_end,
      cancel_at_period_end = p_cancel,
      updated_at = now()
    WHERE id = p_org
      AND (stripe_customer_id IS NULL OR stripe_customer_id = p_customer)
      AND (stripe_subscription_id IS NULL OR stripe_subscription_id = p_subscription OR p_status IN ('active', 'trialing', 'past_due'))
    RETURNING 1
  ) SELECT count(*) > 0 FROM u
$$;--> statement-breakpoint
-- The company's own Stripe account for client payments. Set once; status updates only for that account.
CREATE FUNCTION app_billing_set_connect(p_org uuid, p_account text, p_charges boolean, p_details boolean)
RETURNS boolean
LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
  WITH u AS (
    UPDATE public.organizations SET connect_account_id = p_account, connect_charges_enabled = p_charges, connect_details_submitted = p_details, updated_at = now()
    WHERE id = p_org AND (connect_account_id IS NULL OR connect_account_id = p_account)
    RETURNING 1
  ) SELECT count(*) > 0 FROM u
$$;--> statement-breakpoint
-- Complimentary Pro, set by the platform team.
CREATE FUNCTION app_billing_set_comped(p_org uuid, p_comped boolean)
RETURNS boolean
LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
  WITH u AS (UPDATE public.organizations SET comped = p_comped, updated_at = now() WHERE id = p_org RETURNING 1) SELECT count(*) > 0 FROM u
$$;--> statement-breakpoint
-- Every company and its billing state, for the platform team's admin page (names and plans only).
CREATE FUNCTION app_platform_companies()
RETURNS TABLE (id uuid, name text, created_at timestamptz, plan public.plan, comped boolean, trial_ends_at timestamptz, subscription_status text, deleted_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT o.id, coalesce(o.trading_name, o.name), o.created_at, o.plan, o.comped, o.trial_ends_at, o.subscription_status, o.deleted_at
  FROM public.organizations o ORDER BY o.created_at DESC LIMIT 1000
$$;--> statement-breakpoint
-- One-off: companies that already use Builder OS keep everything (complimentary Pro, no trial clock).
CREATE FUNCTION app_billing_comp_existing()
RETURNS void
LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
  UPDATE public.organizations SET comped = true, trial_ends_at = NULL, updated_at = now() WHERE deleted_at IS NULL
$$;--> statement-breakpoint
GRANT CREATE ON SCHEMA public TO builderos_billing;--> statement-breakpoint
ALTER FUNCTION app_billing_set_customer(uuid, text) OWNER TO builderos_billing;--> statement-breakpoint
ALTER FUNCTION app_billing_apply_subscription(uuid, text, text, public.plan, text, timestamptz, boolean) OWNER TO builderos_billing;--> statement-breakpoint
ALTER FUNCTION app_billing_set_connect(uuid, text, boolean, boolean) OWNER TO builderos_billing;--> statement-breakpoint
ALTER FUNCTION app_billing_set_comped(uuid, boolean) OWNER TO builderos_billing;--> statement-breakpoint
ALTER FUNCTION app_platform_companies() OWNER TO builderos_billing;--> statement-breakpoint
ALTER FUNCTION app_billing_comp_existing() OWNER TO builderos_billing;--> statement-breakpoint
REVOKE CREATE ON SCHEMA public FROM builderos_billing;--> statement-breakpoint
REVOKE ALL ON FUNCTION app_billing_set_customer(uuid, text) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION app_billing_apply_subscription(uuid, text, text, public.plan, text, timestamptz, boolean) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION app_billing_set_connect(uuid, text, boolean, boolean) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION app_billing_set_comped(uuid, boolean) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION app_platform_companies() FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION app_billing_comp_existing() FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_billing_set_customer(uuid, text) TO builderos_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_billing_apply_subscription(uuid, text, text, public.plan, text, timestamptz, boolean) TO builderos_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_billing_set_connect(uuid, text, boolean, boolean) TO builderos_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_billing_set_comped(uuid, boolean) TO builderos_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_platform_companies() TO builderos_app;--> statement-breakpoint
SELECT app_billing_comp_existing();--> statement-breakpoint
DROP FUNCTION app_billing_comp_existing();
