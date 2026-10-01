# Auth, companies and roles

Clerk Organizations for sign-in, companies and invitations (plan §3), mapped onto our own `organizations` and `members` tables. Clerk says who you are and which company you're in. Postgres RLS (see `database.md`) makes sure you only ever see that company's data.

## Layout

| Path | What |
|---|---|
| `src/auth/session.ts` | `getSession()`, `requirePermission()`, `withSession()`. The only way pages and actions learn the user, company and role. |
| `src/auth/clerk-sync.ts` | Copies Clerk organizations and memberships into our tables, in order. Used by the webhook and on first sign-in. |
| `src/auth/clerk-webhook.ts` | Maps verified Clerk webhook events to the sync. |
| `src/app/api/webhooks/clerk/route.ts` | Webhook endpoint. Verifies the Svix signature before anything else. |
| `src/core/roles.ts` | Roles and permissions (`can(role, "costs.view")`). Pure, tested. |
| `src/proxy.ts` | Next.js proxy: signed-out visitors to `/app` and `/m` go to `/sign-in`. Doesn't run on the marketing site. |
| `src/app/(auth)/` | `/sign-in`, `/sign-up`, `/select-company`. Clerk components styled with our tokens. |
| `src/app/app/settings/` | Company settings (Admin edits, other office roles read) and Team (Clerk's member and invitation UI). |
| `scripts/clerk-roles.ts` | `pnpm clerk:roles`: creates our roles in a Clerk instance. |

Only `src/auth`, the proxy and the components that render Clerk's own UI may import `@clerk/*`. Lint enforces this, so moving off Clerk later means changing `src/auth`, not the app.

## Roles

| Role | Clerk key | Can |
|---|---|---|
| Admin | `org:admin` | Everything, including company settings, team and billing. Whoever creates the company gets this. |
| Office | `org:office` | Clients, quotes, invoices and payments. No company settings. |
| Estimator | `org:estimator` | Builds and sends quotes, manages the service library. |
| Site lead | `org:site_lead` | Projects, tasks, photos, variations. **No prices or margins.** |
| Employee | `org:employee` | The employee app (`/m`) only. Default for new invitations. |

- Check permissions with `can(role, permission)` from `src/core/roles.ts`, never by comparing role names. The permission list lives there.
- Anything Clerk sends that we don't recognise, including Clerk's built-in `org:member`, is treated as Employee. A misconfigured Clerk instance can only give people less access, never more.
- The role comes from the Clerk session on each request. The `members.role` column is a synced copy for reporting and history.

## How a request finds its company

1. The proxy checks there's a signed-in session.
2. `getSession()` reads the active Clerk organization and looks up our `organizations.id` with `app_org_for_clerk()`. That is a narrow database function: RLS hides every company until one is selected, so this is the one thing that has to look across companies. It returns only the id and a deleted flag.
3. Everything after that runs in `withSession(session, tx => …)`, which is `withTenant` pinned to that company. **The company never comes from request input.**
4. If the user has no active company, or their company or membership was removed, they go to `/select-company`.

## Keeping our tables in step with Clerk

- **Webhook** (`/api/webhooks/clerk`) handles `organization.*`, `organizationMembership.*`, `user.updated` and `user.deleted`.
- **Order:** Svix can deliver events late or out of order. Each row stores the Clerk time of its last change (`clerk_synced_at`), and older events are ignored. A removal can't be undone by a late update.
- **Deletions are soft:** a deleted company gets `deleted_at` and can't sign in. Its data stays until a purge job runs (to build with the GDPR export and deletion work). Removed members become `active = false` and keep their row, because quotes and clients may point at them.
- **First sign-in fills gaps:** if a user arrives before the webhook does (always the case in local development, since Clerk can't reach your laptop), `getSession()` creates the company and member from Clerk's API. These writes only insert missing rows. They never overwrite webhook data.
- **Company name** is edited in our settings and pushed to Clerk, and Clerk's webhook then writes the same name back.

## Setting up a Clerk instance

Do this once per instance: Development now, Production before launch.

1. **Configure → Organizations:** enable organizations. Leave "Allow personal accounts" off, because every session must be in a company.
2. **Configure → User & authentication:** email + password, email magic link and code, Google, Microsoft. SMS costs extra, so leave it off for now.
3. **Roles:** run `pnpm clerk:roles` with that instance's secret key. It creates the four extra roles, makes Employee the default for new members, and replaces Clerk's built-in Member role. It's safe to run again. It refuses production keys unless you pass `--live`.
4. **Webhook** (needs a public URL, so deployed environments only):
   - **Configure → Webhooks → Add endpoint:** `https://<domain>/api/webhooks/clerk`.
   - **Events:** `organization.created`, `organization.updated`, `organization.deleted`, `organizationMembership.created`, `organizationMembership.updated`, `organizationMembership.deleted`, `user.updated`, `user.deleted`.
   - Copy the signing secret into `CLERK_WEBHOOK_SIGNING_SECRET`.
5. **Environment variables:** `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`. Test keys (`pk_test_`, `sk_test_`) everywhere except production.

## Testing

- `pnpm test` covers roles and permissions, settings parsing, and the webhook route's signature checks (valid, wrong secret, tampered body, stale timestamp, missing headers) with real Svix-style signatures.
- `pnpm test:db` covers the sync against real Postgres as the app role:
  - races, out-of-order deliveries and soft deletes;
  - first-sign-in writes never overwriting synced data;
  - the lookup functions' privileges.
