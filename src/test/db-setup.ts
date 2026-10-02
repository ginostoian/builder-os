/** Vitest global setup for *.db.test.ts: fresh schema, migrations as the owner, app login role. */
import postgres from "postgres";
import { runMigrations } from "../db/migrate";
import { adminUrl, appCredentials, ownerCredentials, ownerUrl } from "./db-urls";

export default async function setup(): Promise<void> {
  const admin = postgres(adminUrl(), { max: 1, onnotice: () => {} });
  try {
    const database = new URL(adminUrl()).pathname.slice(1);
    await admin.unsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${ownerCredentials.user}') THEN
          CREATE ROLE ${ownerCredentials.user} LOGIN CREATEROLE;
        END IF;
      END $$;
      ALTER ROLE ${ownerCredentials.user} PASSWORD '${ownerCredentials.password}';
      -- Roles are server-wide: let this owner manage the lookup role even if another database created it.
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'builderos_lookup') THEN
          GRANT builderos_lookup TO ${ownerCredentials.user} WITH ADMIN OPTION;
        END IF;
      END $$;
      DROP SCHEMA IF EXISTS drizzle CASCADE;
      DROP SCHEMA IF EXISTS public CASCADE;
      CREATE SCHEMA public AUTHORIZATION ${ownerCredentials.user};
      GRANT CREATE ON DATABASE "${database}" TO ${ownerCredentials.user};
    `);
    await runMigrations(ownerUrl());
    await admin.unsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${appCredentials.user}') THEN
          CREATE ROLE ${appCredentials.user} LOGIN;
        END IF;
      END $$;
      ALTER ROLE ${appCredentials.user} PASSWORD '${appCredentials.password}';
      GRANT builderos_app TO ${appCredentials.user};
    `);
  } finally {
    await admin.end();
  }
}
