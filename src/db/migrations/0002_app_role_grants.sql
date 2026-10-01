-- FORCE makes RLS apply to the table owner too, so a mis-set connection string (owner instead of app role)
-- still can't read across tenants. Every new tenant table needs a line here; src/db/tenant-isolation.db.test.ts
-- fails if one is missing.
ALTER TABLE "organizations" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "members" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "clients" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "services" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "service_bundle_items" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "quotes" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "quote_sections" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "quote_lines" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
-- The app role gets row-level DML only. Not TRUNCATE (it ignores RLS), REFERENCES or TRIGGER.
GRANT USAGE ON SCHEMA public TO builderos_app;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO builderos_app;--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO builderos_app;--> statement-breakpoint
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO builderos_app;--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE ON SEQUENCES TO builderos_app;
