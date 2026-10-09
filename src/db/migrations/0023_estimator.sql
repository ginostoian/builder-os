ALTER TABLE "organizations" ADD COLUMN "estimator_token" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "estimator" jsonb;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_estimator_token_key" UNIQUE("estimator_token");--> statement-breakpoint
GRANT UPDATE (estimator_token, estimator, updated_at) ON organizations TO builderos_app;--> statement-breakpoint
GRANT SELECT (estimator_token) ON organizations TO builderos_lookup;--> statement-breakpoint
CREATE FUNCTION app_estimator_lookup(p_token text)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT o.id FROM public.organizations o WHERE o.estimator_token = p_token AND o.deleted_at IS NULL
$$;--> statement-breakpoint
GRANT CREATE ON SCHEMA public TO builderos_lookup;--> statement-breakpoint
ALTER FUNCTION app_estimator_lookup(text) OWNER TO builderos_lookup;--> statement-breakpoint
REVOKE CREATE ON SCHEMA public FROM builderos_lookup;--> statement-breakpoint
REVOKE ALL ON FUNCTION app_estimator_lookup(text) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_estimator_lookup(text) TO builderos_app;
