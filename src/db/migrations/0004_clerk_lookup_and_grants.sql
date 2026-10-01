-- Lookup role: owns the SECURITY DEFINER functions that map Clerk IDs to our IDs (migration 0005).
-- NOLOGIN and no BYPASSRLS. It sees organizations and members only through the read-only `clerk_lookup`
-- policies, and only the columns granted in 0005.
--
-- Roles are shared by every database on a Postgres server. If another database's owner created this role
-- first, this migration's owner needs ADMIN on it to hand over function ownership (see docs/database.md).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'builderos_lookup') THEN
    CREATE ROLE builderos_lookup NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOINHERIT;
  ELSIF NOT pg_has_role(current_user, 'builderos_lookup', 'MEMBER WITH ADMIN OPTION') THEN
    RAISE EXCEPTION 'Role builderos_lookup exists but % has no ADMIN option on it', current_user
      USING HINT = format('As a superuser, run: GRANT builderos_lookup TO %I WITH ADMIN OPTION;', current_user);
  END IF;
END
$$;
