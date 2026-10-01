# Database

Postgres (Neon in London for preview and production), Drizzle ORM, and Row-Level Security for tenant isolation. The design is in `technical-implementation-plan.md` §3–4. This page covers how it works in the code and how to run it.

## Layout

| Path | What |
|---|---|
| `src/core/` | Pure domain logic: money, quote maths, limits, Zod input schemas. No React, no database. Lint enforces this. |
| `src/db/schema.ts` | Drizzle tables, RLS policies, CHECK constraints (limits come from `src/core/limits.ts`). |
| `src/db/migrations/` | SQL migrations. `0000` creates the `builderos_app` role, `0001` is generated from the schema, `0002` forces RLS and sets grants. |
| `src/db/index.ts` | `withTenant(orgId, tx => …)`, the only way app code queries the database. Server-only. |
| `src/db/tenant-isolation.db.test.ts` | Cross-tenant attack tests against real Postgres. |

## Security model

1. **One policy per table.** Every table has `org_id`, plus a `tenant_isolation` policy that matches it to the transaction-local setting `app.org_id`. If the setting is missing, the query sees no rows and can write nothing.
2. **RLS is forced.** RLS applies to the table owner too, so a misconfigured connection string still can't read across tenants.
3. **Composite foreign keys.** References between tenant tables go `(org_id, x_id) → (org_id, id)`. Foreign-key checks ignore RLS, so a plain `x_id` key would let tenant A attach rows to tenant B's quote.
4. **Restricted app role.** The app connects as a login role in `builderos_app`. That role:
   - doesn't own tables and isn't a superuser,
   - has no `BYPASSRLS` and no `TRUNCATE` (TRUNCATE ignores RLS),
   - can't run DDL.

   `withTenant` checks this once per process and refuses to run otherwise.
5. **`withTenant(orgId, fn)`.** It validates `orgId` as a UUID and runs `set_config('app.org_id', orgId, true)` with a 10 s statement timeout, all inside one transaction. Because the setting is transaction-local, it can't leak to the next request on a pooled connection. **`orgId` must come from the session (Clerk, step 4), never from request input.**
6. **Validation at the edge.** Server Actions and Route Handlers parse input with the strict Zod schemas in `src/core/schemas.ts`:
   - Unknown keys are rejected, so a client can't set `orgId` or `id`.
   - Text is length-capped and stripped of control characters.
   - URLs must be https.
   - Money, markup and quantity are bounded.

   The same limits exist as CHECK constraints in the database.
7. **No raw drivers outside `src/db`.** Lint blocks importing `postgres` or `drizzle-orm/postgres-js` anywhere else. `import "server-only"` keeps `@/db` out of client bundles.

**Adding a table:**
- Give it `org_id`, `tenantPolicy(t.orgId)`, `.enableRLS()`, and a `unique(org_id, id)` if anything references it.
- Use composite foreign keys.
- Add a `FORCE ROW LEVEL SECURITY` line in a custom migration.

`pnpm test:db` fails if any table lacks RLS, FORCE or the tenant policy.

## Roles per environment

Migrations create `builderos_app` as a NOLOGIN group role. Each environment then needs two login roles:

```sql
-- Schema owner (runs migrations). On Neon, the project's owner role already exists.
-- Runtime login role, with a long random password stored only in Vercel env vars:
CREATE ROLE builderos_app_prod LOGIN PASSWORD '<random>';
GRANT builderos_app TO builderos_app_prod;
```

- `DATABASE_URL` is the runtime role, using the **pooled** Neon endpoint with `sslmode=require`. Production refuses to start without TLS.
- `DATABASE_URL_OWNER` is the owner role. It is used only by `pnpm db:migrate` in CI or deploy, and is never set on the running app.

## Commands

```bash
pnpm db:generate   # new migration from schema.ts changes (review the SQL before committing)
pnpm db:check      # migration drift / consistency
pnpm db:migrate    # apply migrations (uses DATABASE_URL_OWNER from env or .env.local)
pnpm test:db       # isolation tests; needs TEST_DATABASE_URL_ADMIN
```

## Running the database tests locally

You need a Postgres 16+ superuser and a throwaway database whose name ends in `_test`. Setup drops and recreates its `public` schema.

```bash
createdb builderos_test
TEST_DATABASE_URL_ADMIN=postgres://postgres:postgres@localhost:5432/builderos_test pnpm test:db
```

## Still to do

- Step 4 (auth): sync Clerk organizations and members into `organizations` and `members` with a signature-verified webhook.
  - Mapping a Clerk org ID to our `organizations.id` needs a narrow `SECURITY DEFINER` lookup, because RLS hides every org until one is selected.
- Webhook-only columns: `plan`, `stripe_customer_id` and `connect_account_id` should only change through webhooks. Server Actions must update organizations through `orgSettingsInput`, which doesn't include those columns. Consider column-level grants once webhooks have their own role.
- CI: run `lint`, `typecheck`, `test`, `db:check` and `test:db`, with a Postgres service container.
