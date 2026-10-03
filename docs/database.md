# Database

Postgres (Neon in London for preview and production), Drizzle ORM, and Row-Level Security for tenant isolation. The design is in `technical-implementation-plan.md` §3–4. This page covers how it works in the code and how to run it.

## Layout

| Path | What |
|---|---|
| `src/core/` | Pure domain logic: money, quote maths, limits, Zod input schemas. No React, no database. Lint enforces this. |
| `src/db/schema.ts` | Drizzle tables, RLS policies, CHECK constraints (limits come from `src/core/limits.ts`). |
| `src/db/migrations/` | SQL migrations. `0000` creates the `builderos_app` role, `0001` is generated from the schema, `0002` forces RLS and sets grants, `0003`–`0005` add Clerk sync columns, the Clerk lookup functions and column-level grants on `organizations`. |
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
7. **Clerk lookups.** RLS hides every organization until one is selected, so mapping a Clerk ID to ours needs a narrow cross-tenant read. `app_org_for_clerk(text)` and `app_orgs_for_clerk_user(text)` are `SECURITY DEFINER` functions owned by `builderos_lookup`:
   - It is a NOLOGIN role with no BYPASSRLS.
   - It can read only `organizations (id, clerk_org_id, deleted_at)` and `members (org_id, clerk_user_id)`, through read-only `clerk_lookup` policies.
   - The app role can call these functions but can't become that role.
8. **Column grants on `organizations`.**
   - The app role may insert only `id, clerk_org_id, name, clerk_synced_at, deleted_at`.
   - It may update only the settings columns and sync columns.
   - It may never update `plan`, `stripe_customer_id`, `connect_account_id` or `clerk_org_id`, and may never delete a company (Clerk deletions are soft).
   - Billing webhooks will get their own role in Phase 2.
9. **Client portal (migration 0007).** Clients have no login: each client has one private link, `/portal/{token}`, with 32 random bytes in the token. Every quote sent to them appears there.
   - Public pages call `app_portal_lookup(token)` first. It's a `SECURITY DEFINER` function owned by `builderos_lookup`, like the Clerk lookups, and returns only the company and client of an *active* token. Everything else then runs inside `withTenant` for that company, scoped to that client.
   - Tokens are stored as-is, so the office can copy a link again later. "Reset link" revokes the old row and issues a new token.
   - Clients see `quote_versions.snapshot`: a frozen, client-safe copy made at send time, with selling prices only and only the notes marked "show to client". They never see the live draft, costs or markups.
   - `quote_versions`, `quote_events`, `quote_comments` and `quote_decisions` are append-only for the app role: `UPDATE` and `DELETE` are revoked. `portal_access` rows can only be revoked or touched (`revoked_at`, `last_viewed_at`).
   - An e-signature (`quote_decisions`) stores the full name, typed signature, time, IP, user agent, and the SHA-256 of the exact snapshot accepted. There's one decision per version.
   - Opens are recorded from the page in the browser after 1.5 s on screen, not on the server render, and at most once per half hour. So link previews, email scanners and refreshes don't count, and the team's "Preview as client" never does.
10. **Payment plans and invoices (migration 0008).** Bank transfer only; no card payments.
   - A quote's payment plan (`quotes.payment_plan`) is frozen into the version snapshot when it's sent. The client accepts the amounts they saw.
   - Each payment in the accepted version's plan can be raised as one invoice. A partial unique index allows one live (not void) invoice per payment, and numbers are per company (`INV-0001`).
   - An invoice freezes its amounts, dates, client details and the company's bank details in `snapshot`. For the app role, `invoices` allows updates only to `status, paid_on, paid_reference, sent_at, updated_at`, and no deletes. So "paid", "unpaid" and "void" are the only changes possible after raising.
   - `invoice_reminders` is append-only. Its unique `(invoice, kind)` key is how the reminder job claims each reminder exactly once.
   - Bank details and reminder settings live on `organizations`, with column grants for the app role.
   - The daily reminder job finds companies through `app_orgs_with_due_invoices(date)`, a `SECURITY DEFINER` function owned by `builderos_lookup` that returns only company ids. The lookup role can read just `invoices (org_id, status, due_date)` and `organizations.reminders_enabled` for it. Everything else runs in `withTenant`.
11. **Variations (migration 0009).** A change to an accepted quote: extra work, or work taken out as a credit. The client approves or rejects it in their portal.
   - Drafts can be edited and deleted.
   - Sending freezes a client-safe `snapshot` with its SHA-256 hash: selling prices only, no cost rates or markups.
   - After that, the `variations_guard` trigger blocks any change to the content or amounts, and any delete. The only status changes it allows:
     - `sent` → `approved` (signed: name, typed signature, time, IP, user agent) or `rejected`. Each records the client's decision, once.
     - `sent` → `withdrawn`, done by the team.
   - On an approved variation, only `invoice_id` can change after that.
   - "Revise" withdraws a sent variation and copies it into a new draft. The client never has two versions of the same change to approve.
   - Photos (migration 0010): up to 12 per draft, stored in Bunny under `orgs/{companyId}/photos/` with random names. The browser shrinks each photo to at most 2,000 px and re-encodes it as JPEG, which also removes the location data. When the variation is sent, the photos go into the snapshot as URLs and are then frozen like everything else. A photo file is deleted from storage only when no variation uses it any more, because revisions share photos with the original.
   - Approved variations are billed on their own, or added to a payment's invoice; an invoice's `snapshot.lines` lists each part. A variation is billed while its `invoice_id` points at a live invoice, so voiding that invoice frees it again. Credits can reduce an invoice but never take it below zero.
12. **No raw drivers outside `src/db`.** Lint blocks importing `postgres` or `drizzle-orm/postgres-js` anywhere else. `import "server-only"` keeps `@/db` out of client bundles.

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

Roles are shared by every database on a Postgres server. On Neon each branch is its own server, so nothing more is needed. Locally, if you have several databases with different owners (dev and `_test`, say), migration `0004` stops with a hint. Run its suggested line once, as a superuser:

```sql
GRANT builderos_lookup TO builderos_owner_local WITH ADMIN OPTION;
```

- `DATABASE_URL` is the runtime role, using the **pooled** Neon endpoint with `sslmode=require`. Production refuses to start without TLS.
- `DATABASE_URL_OWNER` is the owner role. It is used only by `pnpm db:migrate` in CI or deploy, and is never set on the running app.

## Production and preview (Neon)

Project `builder-os` (`fragrant-recipe-94754385`), region `aws-eu-west-2`, database `neondb`.

| | Production | Preview |
|---|---|---|
| Neon branch | `production` | `preview` (branched from production on 2026-10-02) |
| Runtime role (Vercel `DATABASE_URL`, pooled host, no quotes) | `builderos_app_prod` | `builderos_app_preview` |
| Vercel environment | Production | Preview |
| Migrated by | `migrate.yml` after CI passes on `main` | `migrate.yml` after CI passes on a pull request |
| Owner secret (`DATABASE_URL_OWNER`, direct host) | GitHub environment `production` | GitHub environment `preview` |

- Owner credentials never go on Vercel. Each branch has its own owner password, so one branch's secret can't unlock the other.
- **Create runtime roles in SQL, never in the Neon console or API.** Neon gives roles it creates `BYPASSRLS` and `neon_superuser` membership, which would let the app read every company's data (`withTenant` refuses to start if it sees that). As the owner:
  ```sql
  CREATE ROLE builderos_app_<env> LOGIN NOBYPASSRLS PASSWORD '<random>';
  GRANT builderos_app TO builderos_app_<env>;
  ```
- The preview branch is shared by every open pull request. If it gets into a bad state (say, two PRs added conflicting migrations), reset it from its parent in the Neon console, then re-run the workflow by hand (Actions → Migrate database → Run workflow → `preview`). Resetting restores production's roles and passwords on that branch, so recreate `builderos_app_preview` and reset the branch's owner password afterwards.
- Schema `legacy_prisma` holds the tables from the February 2026 Prisma prototype. They were moved out of `public` on 2026-10-02 so the app role's grants never reach them. The app role has no access to that schema. Neon branch `backup-before-drizzle-2026-10-02` is a snapshot from just before that move.

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
TEST_DATABASE_URL_ADMIN=postgres://postgres:<password>@localhost:5432/builderos_test pnpm test:db
```

The test roles (`builderos_owner_test`, `builderos_app_test`) get fresh random passwords on every run.

## Still to do

- Phase 2: a separate database role for the Stripe billing webhooks, the only role allowed to update `plan`, `stripe_customer_id` and `connect_account_id`.
- A purge job for soft-deleted companies after the grace period, built with the per-company GDPR export (plan §7).
