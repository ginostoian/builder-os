/**
 * Apply migrations as the schema owner: `pnpm db:migrate`. Never run with the app role's URL.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

export async function runMigrations(ownerUrl: string): Promise<void> {
  const client = postgres(ownerUrl, { max: 1, onnotice: () => {} });
  try {
    await migrate(drizzle(client), { migrationsFolder: new URL("./migrations", import.meta.url).pathname });
  } finally {
    await client.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const url = process.env.DATABASE_URL_OWNER;
  if (!url) {
    console.error("DATABASE_URL_OWNER is not set");
    process.exit(1);
  }
  runMigrations(url).then(
    () => console.log("Migrations applied"),
    (error: unknown) => {
      console.error(error);
      process.exit(1);
    },
  );
}
