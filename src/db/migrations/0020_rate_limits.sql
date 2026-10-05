CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"window_start" timestamp with time zone DEFAULT now() NOT NULL,
	"hits" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "rate_limits_key_format" CHECK ("rate_limits"."key" ~ '^[a-z_]{1,40}:[0-9a-f]{64}$'),
	CONSTRAINT "rate_limits_hits_range" CHECK ("rate_limits"."hits" between 0 and 1000000)
);
--> statement-breakpoint
ALTER TABLE "rate_limits" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "rate_limits_window_idx" ON "rate_limits" USING btree ("window_start");--> statement-breakpoint
CREATE POLICY "no_tenant_only" ON "rate_limits" AS PERMISSIVE FOR ALL TO "builderos_app" USING (current_setting('app.org_id', true) is null or current_setting('app.org_id', true) = '') WITH CHECK (current_setting('app.org_id', true) is null or current_setting('app.org_id', true) = '');--> statement-breakpoint
ALTER TABLE "rate_limits" FORCE ROW LEVEL SECURITY;
