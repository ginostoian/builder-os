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
   - Billing columns change only through the `builderos_billing` functions (see Billing, migration 0018).
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
12. **Projects (migration 0011).** Running a job: `projects` (at most one per quote), `project_phases` (stages), `project_tasks`, `project_diary` and `project_files`.
   - All five have forced RLS and composite foreign keys. A task's stage must belong to the same project: the key is `(org_id, project_id, phase_id)`.
   - Starting from an accepted quote copies the sections the client accepted (the version snapshot, not the live draft) as stages, and optionally each line as a task.
   - The client's portal shows a project only if `share_progress` is on. Even then it shows:
     - per-stage counts;
     - diary entries marked shared;
     - files marked shared.

     It never shows task titles or notes.
   - Diary photos and files are stored on Bunny under `orgs/{companyId}/photos/` and `orgs/{companyId}/files/` with random names. Files are PDFs or images, checked by their bytes, up to 4 MB, which is Vercel's request limit. Deleting an entry, a file or a project also deletes its files from storage.
13. **Team and site app (migrations 0012–0013).** `workers` is everyone who works for the company, with or without a login; `worker_certificates` holds their cards and tickets; `site_visits` holds check-ins and check-outs.
   - A worker can be linked to one member (`workers.member_id`, unique per company). Every active member gets a worker automatically (`ensureWorkerForMember`, called from `syncMember`). It reuses an unlinked worker with the same email if there is one. Migration 0012 created workers for existing members.
   - Tasks are assigned to workers (`project_tasks.worker_id`), not members, so labourers and subcontractors without a login can have tasks. Migration 0012 copied the old member assignments across, and 0013 dropped `assignee_member_id`. Marking someone as left unassigns their open tasks and closes any open visit.
   - A worker has at most one open visit (a partial unique index). Checking in closes the previous visit first. Location is optional, numeric(9,6), and checked to be in range. Timesheets group visits by the UK day they started.
   - The site app (`src/db/site.ts`) is scoped to the signed-in member's worker. It shows only active jobs they manage or have a task on, and changes only their own tasks and visits.
   - Certificate reminders: the daily cron finds companies through `app_orgs_with_expiring_certificates(date)`, a `SECURITY DEFINER` function owned by `builderos_lookup`. It can read only `worker_certificates (org_id, worker_id, expires_on, reminded_at)` and `workers (id, org_id, archived_at)`. Each certificate is emailed once to admins and office. `reminded_at` is reset when its expiry date changes.
14. **Job costs (migration 0014).** `expenses` (receipts, supplier bills, subcontractor invoices) and `purchase_orders`, both per project with forced RLS and composite FKs.
   - Expenses store the total and the VAT part; `net = total - vat` is checked. Receipts are photos or PDFs on Bunny under `orgs/{companyId}/receipts/`, at most 6 per expense.
   - `rechargeable` marks a purchase made on the client's behalf. It is billed back through `createInvoice` (`expenseIds`, a "Purchased on your behalf" line at the quote's VAT rate, cost plus `recharge_markup_bps`), or marked paid back with `recovered_on`. A recharge on a live invoice can't be edited or deleted; cancelling the invoice frees it.
   - Costing (`jobCosting`, `costingReport`): income is the accepted quote's net plus approved variations; the estimate is the quote's cost prices plus approved variations' costs; costs are non-recharge expenses (net if the company has a VAT number, gross if not) plus labour. Labour is site-visit minutes × day rate ÷ 480, using `site_visits.day_rate_pence`, recorded at check-in (migration 0014 back-filled it from current rates).
   - Purchase orders are numbered per company under an advisory lock, as invoices are. Drafts can be deleted; sent ones are cancelled instead.
15. **Sales pipeline (migration 0015).** The tables are `leads`, `lead_activities` (the timeline), `automations` (the company's own email sequences) and `automation_runs` (one lead going through one automation). All have forced RLS and composite FKs.
   - **Stages.** Changes go through `setStage`, which does three things: it logs the change, stops runs that belong to another stage, and starts the switched-on automations for the new stage.
   - **Quotes move their lead.** `sendQuote` moves it to Quote sent. `decide` moves it to Won, or to Lost with `declined_quote`. A lost lead must have a reason (check constraint).
   - **Automation runs.** At most one live run per automation and lead (partial unique index).
     - `claimDueEmails` reserves each due step before sending, row-locked with `skip locked`, so overlapping runners never send twice.
     - A run stops when the lead leaves its stage, opts out or has no email; when the automation is switched off or its trigger changes; or when the step is over 3 days late.
     - Steps are due at the start of the UK day, `delayDays` after the previous step. Same-day steps go at once, because actions call `runCompanyAutomations` in `after()`.
   - **Lookups.** Four public entry points use `SECURITY DEFINER` functions owned by `builderos_lookup`, each returning only ids:
     - `app_enquiry_form_lookup(token)`, for the web form; it matches `organizations.enquiry_token`;
     - `app_estimator_lookup(token)`, for the website cost estimator (migration 0023); it matches `organizations.estimator_token`. The estimator's settings are `organizations.estimator` (jsonb, checked against `estimatorSettings` in `src/core/estimator.ts` when read);
     - `app_lead_unsubscribe_lookup(token)`, for unsubscribe links; it matches `leads.unsubscribe_token`;
     - `app_orgs_with_due_automations(now)`, for the daily cron.

     The lookup role can read only the columns those functions match on.
16. **Notifications (migration 0016).** One `notifications` row per person per event (the bell), with forced RLS and an FK to `members` that cascades.
   - `notify` writes them inside the same tenant transaction as the event. It skips inactive members, repeats and, usually, whoever did it. It also clears that person's rows older than 90 days.
   - Who hears about what:
     - quote opened, commented on, accepted or declined, and variation decisions: whoever sent the quote, or the admins if they've left;
     - web enquiries and receipts logged from the site app: admins and office;
     - leads and tasks handed to someone: the new owner, or the worker's linked login (employees get a site app link);
     - expiring certificates: admins and office, from the daily cron, even when email isn't set up.
   - `href` must be a path inside the app (check constraint: starts with `/`, not `//`).
   - Search (`src/db/search.ts`) and the calendar (`src/db/calendar.ts`) only read, inside the tenant transaction, and check the role per kind of result.
17. **Survey booking (migration 0017).**
   - `survey_settings` (one row per company: on/off, visit length, travel time, notice, how far ahead, postcode areas) and `survey_hours` (each person's weekly windows, UK time).
   - `survey_bookings` holds the visits; the lead's `visit_at` mirrors the live one.
     - One live booking per lead (partial unique index).
     - **No double-booking:** an exclusion constraint (`btree_gist`) refuses two live bookings of one person that overlap, so two clients picking the same slot at once can't both get it (`23P01` → "just taken").
     - Bookings are cancelled, never deleted (the app role has no DELETE); they go with their lead.
   - What's on offer is worked out in `src/core/surveys.ts`, from hours minus existing visits (with travel time either side), notice and range. Each time is offered once and given to whoever is free with the fewest visits that day. A client can only book a time that's on offer; the office can book any time, with anyone.
   - The client's booking page uses the lead's private link token (the same one as unsubscribe), found with `app_lead_unsubscribe_lookup`.
   - `app_orgs_with_due_survey_reminders(from, to)` finds companies with visits to remind about; the lookup role can see only `org_id`, `status`, `starts_at` and `reminder_sent_at` of bookings.
18. **Client portal sign-in (migration 0017).**
   - `organizations.portal_sign_in` (default on): on a new device the client confirms their email before the portal opens.
   - `portal_codes`: 6-digit codes and one-time sign-in links, stored as SHA-256 (with the portal link's id mixed in). At most 6 per portal link per hour; a code allows 5 tries and lasts 10 minutes. The app role can only update `attempts` and `used_at`.
   - `portal_sessions`: remembered devices. The cookie holds a random secret; only its hash is stored. 90 days; the app role can only update `last_seen_at`. Sessions belong to one portal link, so resetting the link signs everyone out.
   - "Find my portal" (`/portal`) uses `app_portal_by_email(email)`, which returns ids of active links whose (non-archived) client has that email. The lookup role can see only `id`, `org_id`, `email` and `archived_at` of clients.
   - Every portal page and action checks `requirePortal` itself (never only a layout), so nothing private is read for a browser that hasn't signed in.
19. **No raw drivers outside `src/db`.** Lint blocks importing `postgres` or `drizzle-orm/postgres-js` anywhere else. `import "server-only"` keeps `@/db` out of client bundles.

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

## Billing (migration 0018)

- `organizations` gains `trial_ends_at` (new companies: 14 days from creation), `comped` (complimentary Pro), `stripe_subscription_id`, `subscription_status`, `current_period_end`, `cancel_at_period_end`, `connect_charges_enabled` and `connect_details_submitted`. Stripe ids are unique and CHECKed for their `cus_`, `sub_` and `acct_` prefixes.
- The app role can't update any of them. They change only through `SECURITY DEFINER` functions owned by `builderos_billing`, a NOLOGIN role with no BYPASSRLS that can read `organizations` and update just those columns (through its `billing_access` policy). The app role can call the functions but can't become the role.
  - `app_billing_set_customer(org, customer)`: only when the company has no customer yet, or the same one.
  - `app_billing_apply_subscription(…)`: only for the company's own customer. The plan falls back to Free unless the status is `active`, `trialing` or `past_due`, and an ended subscription can't overwrite a newer one.
  - `app_billing_set_connect(org, account, charges, details)`: only for the company's own connected account (or its first one).
  - `app_billing_set_comped(org, comped)` and `app_platform_companies()`: for the platform admin page, which checks the signed-in member's email against `PLATFORM_ADMIN_EMAILS` first.
- The values written always come from Stripe's API (re-fetched by id), never from a webhook body.
- What a company gets (`src/core/plans.ts`): complimentary → Pro; a live subscription → its plan; in trial → Pro; otherwise Free. Every company that existed before this migration was set to complimentary Pro, with no trial.
- `invoices.stripe_payment_id` (unique) records an online payment; the app role may set it along with the paid status. An invoice is marked paid online only if the payment is on the company's own connected account and the amount equals the invoice total.
- The migration creates `builderos_billing` if it's missing and grants it to the migrating role `WITH INHERIT FALSE, SET TRUE` (Postgres 16 needs SET to hand a function to a role).

## Platform metrics and getting started (migration 0019)

- `member_activity`: one row per person per UK day, with page views, sessions (a view after 30 minutes away starts a new one) and site app views. The app records it from a beacon in the office and site apps (`activityAction`); it can insert and update, not delete. Only counts are stored, never which pages.
- `subscription_events`: every change to what a company pays us (`mrr_before_pence`, `mrr_after_pence`), written by `app_billing_apply_subscription`, which now also takes the subscription's monthly amount and keeps `organizations.mrr_pence` current. The app role has no access to this table at all.
- `builderos_metrics`: a NOLOGIN, read-only role with no BYPASSRLS. It can read a handful of columns (plans, MRR, member and activity counts, quote send dates, project and lead dates, invoice paid totals) through `platform_metrics` policies and column grants. It owns four `SECURITY DEFINER` functions that return totals and per-company counts for the website owner's admin area (`/admin`): `app_platform_company_stats`, `app_platform_daily_activity`, `app_platform_subscription_events`, `app_platform_user_signups`. Pages check the signed-in Clerk user's verified email against `PLATFORM_ADMIN_EMAILS` (and two-step verification) before calling them, through `withPlatform`, a transaction with no tenant.
- `members.onboarding_tour_at`, `onboarding_hidden` and `onboarding_seen` hold each person's tour and checklist choices. Checklist progress itself is read from the company's own data, so it can't drift.

## Rate limits (migration 0020)

`rate_limits` holds counters for public forms and actions: one row per key (`bucket:hmac`) and fixed window. Keys are HMACs, so no IP address or email is stored. It's visible to the app role only outside a tenant (`app.org_id` unset), through `hitRateLimit`, which runs on its own connection without `withTenant`. The daily job deletes windows that ended over a day ago.

## Still to do

- A purge job for soft-deleted companies after the grace period, built with the per-company GDPR export (plan §7).
