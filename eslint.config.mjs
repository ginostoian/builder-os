import next from "eslint-config-next";

const dbBoundary = [
  { group: ["postgres", "drizzle-orm/postgres-js", "drizzle-orm/postgres-js/*"], message: "Query through withTenant() from @/db." },
  { group: ["@/db/migrate", "@/db/env"], message: "Internal to src/db." },
];
const clerkBoundary = { group: ["@clerk/*"], message: "Use @/auth (getSession, withSession, …). Clerk stays behind src/auth." };

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
    // Raw database drivers stay inside src/db (everything else goes through withTenant()), and Clerk stays
    // behind src/auth so it can be swapped out (plan §3, "Escape hatch").
    files: ["src/**"],
    ignores: ["src/db/**", "src/test/**", "src/core/**", "src/**/*.db.test.ts"],
    rules: { "no-restricted-imports": ["error", { patterns: [...dbBoundary, clerkBoundary] }] },
  },
  {
    // Where Clerk is allowed: the auth module, the proxy, and the components that render Clerk's own UI.
    files: [
      "src/auth/**",
      "src/proxy.ts",
      "src/components/auth/**",
      "src/components/app/account.tsx",
      "src/components/app/settings/team-settings.tsx",
      "src/app/(auth)/**",
    ],
    ignores: ["src/**/*.db.test.ts"],
    rules: { "no-restricted-imports": ["error", { patterns: dbBoundary }] },
  },
];

export default config;
