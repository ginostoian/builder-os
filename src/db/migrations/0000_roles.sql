-- Runtime group role. NOLOGIN: each environment creates its own LOGIN role with a secret password
-- and grants it membership (see docs/database.md). It must never own tables or bypass RLS.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'builderos_app') THEN
    CREATE ROLE builderos_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOINHERIT;
  END IF;
END
$$;
--> statement-breakpoint
-- Nobody gets to create objects in public by default; only the migration owner does.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
