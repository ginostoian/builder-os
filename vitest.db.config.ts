import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const src = fileURLToPath(new URL("./src", import.meta.url));

// Database tests: real Postgres, real roles, real RLS. See docs/database.md for the env vars.
export default defineConfig({
  resolve: { alias: { "@": src, "server-only": `${src}/test/server-only.ts` } },
  test: { include: ["src/**/*.db.test.ts"], globalSetup: ["src/test/db-setup.ts"], fileParallelism: false },
});
