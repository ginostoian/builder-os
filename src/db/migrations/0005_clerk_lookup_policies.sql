CREATE POLICY "clerk_lookup" ON "members" AS PERMISSIVE FOR SELECT TO "builderos_lookup" USING (true);--> statement-breakpoint
CREATE POLICY "clerk_lookup" ON "organizations" AS PERMISSIVE FOR SELECT TO "builderos_lookup" USING (true);--> statement-breakpoint
-- ── Clerk lookups ────────────────────────────────────────────────────────────
-- RLS hides every organization until withTenant() selects one, so the session and the webhook can't find
-- which of our organizations a Clerk ID belongs to. These two functions answer exactly that and nothing more.
-- They run as builderos_lookup, which can read only the id columns below.
GRANT USAGE ON SCHEMA public TO builderos_lookup;--> statement-breakpoint
GRANT SELECT (id, clerk_org_id, deleted_at) ON organizations TO builderos_lookup;--> statement-breakpoint
GRANT SELECT (org_id, clerk_user_id) ON members TO builderos_lookup;--> statement-breakpoint
CREATE FUNCTION app_org_for_clerk(p_clerk_org_id text)
RETURNS TABLE (id uuid, deleted boolean)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT o.id, o.deleted_at IS NOT NULL FROM public.organizations o WHERE o.clerk_org_id = p_clerk_org_id
$$;--> statement-breakpoint
CREATE FUNCTION app_orgs_for_clerk_user(p_clerk_user_id text)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT DISTINCT m.org_id FROM public.members m WHERE m.clerk_user_id = p_clerk_user_id
$$;--> statement-breakpoint
-- Hand ownership to builderos_lookup. The migration owner created that role, so it holds ADMIN on it and
-- can grant itself SET. A new owner needs CREATE on the schema only for the ALTER itself.
GRANT builderos_lookup TO CURRENT_USER WITH SET TRUE, INHERIT FALSE;--> statement-breakpoint
GRANT CREATE ON SCHEMA public TO builderos_lookup;--> statement-breakpoint
ALTER FUNCTION app_org_for_clerk(text) OWNER TO builderos_lookup;--> statement-breakpoint
ALTER FUNCTION app_orgs_for_clerk_user(text) OWNER TO builderos_lookup;--> statement-breakpoint
REVOKE CREATE ON SCHEMA public FROM builderos_lookup;--> statement-breakpoint
REVOKE ALL ON FUNCTION app_org_for_clerk(text), app_orgs_for_clerk_user(text) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_org_for_clerk(text), app_orgs_for_clerk_user(text) TO builderos_app;--> statement-breakpoint
-- ── Webhook-only columns ─────────────────────────────────────────────────────
-- plan, stripe_customer_id and connect_account_id change only through billing webhooks (Phase 2, own role).
-- The app role may create an organization (from Clerk) and edit its settings, but never delete one: Clerk
-- deletions are soft (deleted_at) so data can be exported or restored before it is purged.
REVOKE INSERT, UPDATE, DELETE ON organizations FROM builderos_app;--> statement-breakpoint
GRANT INSERT (id, clerk_org_id, name, clerk_synced_at, deleted_at) ON organizations TO builderos_app;--> statement-breakpoint
GRANT UPDATE (name, trading_name, vat_number, logo_url, brand_colour, default_markup_bps, default_vat_rate_bps, quote_terms, clerk_synced_at, deleted_at, updated_at) ON organizations TO builderos_app;
