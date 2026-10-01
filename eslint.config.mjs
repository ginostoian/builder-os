import next from "eslint-config-next";

const config = [
  ...next,
  { ignores: ["project/**", ".next/**"] },
  {
    // Pure domain logic: no framework, no database, no app code. Runs anywhere and is trivially testable.
    files: ["src/core/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { regex: "^(@/(?!core/)|\\.\\./)", message: "src/core may only import from src/core." },
            { group: ["react", "react-dom", "next", "next/*", "drizzle-orm", "drizzle-orm/*", "postgres"], message: "src/core must stay framework- and database-free." },
          ],
        },
      ],
    },
  },
  {
    // Raw database drivers stay inside src/db. Everything else goes through withTenant().
    files: ["src/**"],
    ignores: ["src/db/**", "src/test/**", "src/core/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["postgres", "drizzle-orm/postgres-js", "drizzle-orm/postgres-js/*"], message: "Query through withTenant() from @/db." },
            { group: ["@/db/migrate", "@/db/env"], message: "Internal to src/db." },
          ],
        },
      ],
    },
  },
];

export default config;
