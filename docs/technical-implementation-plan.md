# Builder OS: Technical Implementation Plan

**Version 1.0, October 2026**
Companion to the Design Guidelines (`/design-guidelines`, prototype in `project/Design Guidelines.dc.html`). The designs in `project/` (`Home`, `Features`, `Pricing`, `Builder OS App`, etc.) are the target product.

---

## 1. Goals and constraints

| | |
|---|---|
| **Product** | Multi-tenant SaaS for UK renovation companies (2–50 staff): quoting, variations, payment plans, invoicing, client portal, projects, employees and employee app, CRM, reporting. |
| **Users** | Three audiences with very different needs: **company staff** (office, desktop, dense UI), **employees on site** (phone, gloves, patchy signal), **homeowners** (their client; no account, one link). |
| **Tenancy** | One company = one tenant. A user can belong to more than one company (e.g. a freelance PM). |
| **Commercial** | Free / Essentials £49 / Pro £119, per company, + VAT. Feature gating per plan. |
| **Non-functional** | UK data residency, generous free tiers to start, nothing we'd have to re-platform at 5,000 tenants. |
| **Front end** | Latest Next.js (App Router), every UI piece built as shadcn/ui components themed to the Builder OS tokens. |

---

## 2. Stack decisions

| Layer | Choice | Why | Free tier at start |
|---|---|---|---|
| Framework | **Next.js 16.3.x (Active LTS)**, React 19, TypeScript strict | Latest stable LTS line. Server Components and Server Actions keep most data work on the server. Pin the minor and patch monthly: 16.x has had frequent security releases. | – |
| Styling / UI | **Tailwind CSS v4 + shadcn/ui** (Radix primitives) + **Lucide** icons | Matches the design system 1:1 via CSS variables (see Design Guidelines §10). We own the component code. | – |
| Auth & tenancy | **Clerk** with **Organizations** | See §3. Prebuilt sign-in, org switcher, invites, roles, Next.js middleware. | 50k monthly retained users; 100 retained orgs; ≤20 members per org |
| Database | **Neon serverless Postgres, AWS London (eu-west-2)** | Plain Postgres (no lock-in), UK residency, branch-per-PR for previews, scale-to-zero, autoscaling. | 100 CU-hours and 0.5 GB per project; paid plans usage-based with no minimum |
| ORM / migrations | **Drizzle ORM + drizzle-kit** | Type-safe SQL, first-class Postgres RLS helpers, light at runtime. | – |
| File storage | **Cloudflare R2** (EU jurisdiction bucket). Swap to **S3 eu-west-2** if a customer contractually needs UK-only storage. | Progress photos and PDFs; zero egress fees matter for photo-heavy portals. | 10 GB |
| Hosting | **Vercel**, functions pinned to `lhr1` (London) | Native Next.js, preview per PR, Neon integration for DB branches. | Hobby → Pro ($20/seat) at launch |
| Background jobs & workflows | **Inngest** | Payment reminders, quote follow-ups, email automations, PDF rendering, Xero sync. Durable, retryable, cron. | 50k runs/mo |
| Email | **Resend + React Email** | Transactional email from our domain and from verified customer domains (Pro). | 3k/mo |
| Payments (our subscriptions) | **Stripe Billing** + Customer Portal | Free/Essentials/Pro, trials, VAT via Stripe Tax. | Pay per transaction |
| Payments (contractor → homeowner) | **Stripe Connect (Express accounts)** with cards + **Pay by Bank** (UK open banking) | Money goes straight to the contractor; we never hold funds. Optional platform fee later. | Pay per transaction |
| PDF | **@react-pdf/renderer** in a Node-runtime route / Inngest step | Same React components as the client link, branded per tenant. | – |
| Rate limiting / cache | **Upstash Redis** | Public quote links, auth endpoints, webhooks. | 500k commands/mo |
| Observability | **Sentry** (errors, performance) + **PostHog EU Cloud** (product analytics, feature flags, session replay with masking) | EU-hosted analytics; flags let us ship modules dark. | Generous free tiers |
| Search | **Postgres full-text + pg_trgm** | Service library autocomplete ("plast" → plaster skim) and global ⌘K search. No extra service until needed. | – |
| Marketing content | **MDX in repo** (blog, customer stories) via `next-mdx-remote` / Content Collections | Zero-cost, versioned, fast. Move to a headless CMS only if non-devs publish weekly. | – |
| Demo booking | **Cal.com** embed (Book a demo page) | The booking UI in our design is Cal-style. Embed it and theme it. | Free |

---

## 3. Auth and multi-tenancy (the important decision)

### Options considered

| | Clerk (Organizations) | WorkOS AuthKit | Better Auth (self-hosted, org plugin) | Supabase Auth |
|---|---|---|---|---|
| Multi-tenant model | First-class orgs, roles, invites, org switcher UI | First-class orgs, strongest enterprise SSO | Org plugin, we build the UI | DIY (no org primitive) |
| Next.js DX | Excellent: middleware, `auth()` in RSC, prebuilt components | Good | Good, more code | OK; pulls us towards Supabase DB |
| Free tier | 50k MRU, 100 orgs, 20 members/org | 1M MAU free | Free (our infra) | 50k MAU |
| Cost risk | B2B add-on (~$100/mo + $1/org above 100) once we pass 100 active companies or a firm passes 20 members | SSO per connection (not needed for SMBs) | Engineering time | Low, but tenancy is all on us |
| Ops burden | None | None | We own security, sessions, MFA | Low |

### Decision: **Clerk Organizations**, wrapped behind our own `@builderos/auth` interface

- Fastest route to the shipped product: sign-in, invites, roles and the workspace switcher (sidebar top-left in the app design) come prebuilt and restylable.
- **Cost check:** the B2B add-on becomes necessary at about 100 paying firms, or as soon as one firm has more than 20 staff on the platform. At £49–£119 per company per month, ~$1 per org is negligible. Budget the add-on from public launch.
- **Escape hatch:** keep every auth call behind `src/auth` (`getSession()`, `requirePermission()`, `withSession()`; lint blocks `@clerk/*` elsewhere). If Clerk pricing or limits change, Better Auth's organization plugin on our own Neon DB is the migration target.

### Identity model

| Actor | How they authenticate | Clerk entity |
|---|---|---|
| Owner / office staff | Email + password / Google / Microsoft, MFA optional | User + org membership, role `org:admin` or `org:office` |
| Employee (site) | Magic link or SMS code, long-lived session on phone | User + org membership, role `org:employee` |
| Homeowner (client) | **No Clerk account.** Signed, expiring, revocable link (`builderos.app/q/{token}`), plus optional email OTP to view the portal | Our own `portal_access` table |
| Builder OS staff | Separate Clerk instance or `superadmin` metadata, plus impersonation with audit | – |

Keeping homeowners out of Clerk keeps them out of the member limits, removes sign-up friction for clients, and means they can't be lumped in with staff permissions by accident.

### Tenant isolation (defence in depth)

1. **Every tenant table has `org_id uuid not null`**, indexed and part of composite unique keys.
2. **Postgres Row-Level Security** on all tenant tables:
   ```sql
   alter table quotes enable row level security;
   create policy tenant_isolation on quotes
     using (org_id = current_setting('app.org_id')::uuid);
   ```
3. A single DB entry point `withTenant(orgId, tx => …)` runs `set_config('app.org_id', $1, true)` inside the transaction. The app connects as a non-owner role that **cannot bypass RLS**.
4. Clerk org ID → our `organizations.id` mapping is synced by webhook (`organization.*`, `organizationMembership.*`, `user.updated/deleted`), with a first-sign-in fallback. See `docs/auth.md`.
5. Automated test: a Playwright and Vitest suite that tries to read and write across two seeded tenants on every PR.

---

## 4. Architecture

### Single app (no monorepo for now)

One Next.js app, with folders that behave like packages. Lint rules enforce the boundaries, so splitting into a Turborepo later (e.g. when an Expo employee app needs to share `core`) is a mechanical move.

```
builder-os/
├─ src/
│  ├─ app/(marketing)/         # builderos.co.uk: Home, Features, Pricing, Blog, Customers, About, Demo
│  ├─ app/app/                 # authenticated admin app
│  ├─ app/q/                   # client quote links & portal (no Clerk)
│  ├─ app/m/                   # PWA for site staff
│  ├─ app/api/                 # webhooks (Clerk, Stripe, Resend), Inngest, public API later
│  ├─ core/                    # pure domain logic: money (pence ints), VAT, quote totals, limits, Zod schemas
│  ├─ db/                      # Drizzle schema, migrations, RLS policies, withTenant()
│  ├─ auth/                    # Clerk wrapper + permission map (step 4)
│  ├─ components/ui/           # shadcn/ui components + Builder OS composites
│  ├─ emails/, pdf/            # React Email templates, React-PDF documents (later)
│  └─ lib/                     # demo data, content, utilities
└─ e2e/                        # Playwright (later)
```

- `src/core` imports nothing outside itself, and nothing from React, Next or the database.
- Raw database drivers can only be imported inside `src/db`. Everything else queries through `withTenant()`.

### Request patterns

- **Reads:** React Server Components calling `src/db` query functions inside `withTenant`.
- **Writes:** Server Actions validated with **Zod** (shared schemas in `core`) → domain function → DB → `revalidateTag`.
- **Quote grid:** client component (TanStack Table + custom keyboard model). Edits are optimistic in local state, debounced autosave (500 ms) via a Server Action that applies a **patch list** (`[{op:'update', lineId, field, value}]`), not the whole quote. Conflict guard with `version` column.
- **Webhooks and public endpoints:** Route Handlers, signature-verified, rate-limited, idempotent (store event IDs).
- **Long work:** anything >1 s (PDF, email batches, Xero sync, image processing) goes to Inngest.

### Core data model (first pass)

```
organizations(id, clerk_org_id, name, trading_name, vat_number, logo_url, brand_colour, plan, stripe_customer_id, connect_account_id, default_markup_bps, default_vat_rate_bps, quote_terms, created_at)
members(id, org_id, clerk_user_id, role, name, phone, trade, day_rate_pence, active)
clients(id, org_id, name, email, phone, address jsonb, source, owner_member_id)
enquiries(id, org_id, client_id, title, job_type, est_value_pence, stage, source, next_action_at)   -- CRM pipeline
services(id, org_id, category, name, description, unit, rate_pence, default_markup_bps, kind[service|bundle], usage_count)
service_bundle_items(bundle_id, service_id, qty)
quotes(id, org_id, client_id, enquiry_id, number, title, site_address, status, valid_until, markup_bps, vat_rate_bps, version, sent_at, accepted_at)
quote_sections(id, org_id, quote_id, position, name, collapsed)
quote_lines(id, org_id, section_id, position, service_id null, name, qty numeric(12,3), unit, rate_pence, markup_bps, note, note_visible, kind[normal|pc_sum|provisional])
quote_versions(id, org_id, quote_id, version, snapshot jsonb, pdf_key, hash)          -- immutable on send
signatures(id, org_id, subject_type, subject_id, version_hash, signer_name, signer_email, ip, user_agent, signed_at)
payment_plans(id, org_id, quote_id|project_id) / payment_stages(id, plan_id, position, label, pct_bps|amount_pence, trigger[manual|task_done|date], status)
variations(id, org_id, project_id, number, title, description, amount_pence, status[draft|sent|approved|rejected], photos[], approved_at, stage_id)
invoices(id, org_id, client_id, project_id, number, status, issue_date, due_date, subtotal_pence, vat_pence, total_pence, stripe_payment_intent, paid_at)
invoice_lines(id, org_id, invoice_id, source_type, source_id, description, amount_pence, vat_rate_bps)
projects(id, org_id, quote_id, client_id, name, address, status, start_date, end_date)
tasks(id, org_id, project_id, column, position, title, assignee_member_id, due_date, tag, source_line_id)
photos(id, org_id, project_id, task_id, uploaded_by, r2_key, taken_at, visible_to_client)
site_checkins(id, org_id, member_id, project_id, in_at, out_at, lat, lng)
documents(id, org_id, project_id, kind, r2_key, visible_to_client)
portal_access(id, org_id, client_id, subject_type, subject_id, token_hash, expires_at, revoked_at, last_viewed_at)
activity(id, org_id, actor_type, actor_id, subject_type, subject_id, verb, data jsonb, at)   -- feeds "opened 3×", audit log
notifications(id, org_id, member_id, kind, payload, read_at)
automations(id, org_id, trigger, conditions jsonb, action, template_id, enabled)
```

**Money rule:** all money is **integer pence**, all percentages are **basis points**, and quantities are `numeric(12,3)`. Every total is computed in `src/core` (unit-tested, property-tested) and never in the UI or SQL ad hoc. Line total = `round(qty × rate × (1 + markup))` per line, then section and quote sums, then VAT on the net. This exactly matches the summary panel in the quote builder design.

### Surfaces → routes (screen map)

| Design screen | Route | Notes |
|---|---|---|
| Home, Features, Pricing, Blog, Article, Customers, About, Book a demo | `(marketing)/…` | Static/ISR, MDX content, Cal.com embed |
| Dashboard | `(app)/` | KPIs from SQL views; cached 60 s |
| Quote builder | `(app)/quotes/[id]` | `QuoteGrid`, summary panel, note popovers, library autocomplete |
| Service library | `(app)/library` | Categories, search (pg_trgm), CSV import |
| Client quote link | `(portal)/q/[token]` | No auth, accept & sign, line comments, view tracking |
| Project board | `(app)/projects/[id]` | dnd-kit kanban, tabs: board/timeline/photos/variations/files/payments |
| Payments | `(app)/payments` | Plan bar, invoices table, invoice preview |
| CRM pipeline | `(app)/clients` | Kanban of `enquiries` by stage |
| Employee app | `(employee)/m` | PWA, offline photo queue, check-in |

---

## 5. Build pipeline and environments

```
feature branch ─► PR ─► GitHub Actions ─────────────────────────────► Vercel Preview
                         ├ pnpm install (cached)                       └ Neon branch per PR (Vercel–Neon integration)
                         ├ lint · typecheck · vitest                    (seeded with 2 demo tenants)
                         ├ drizzle-kit check (migration drift)
                         ├ Playwright e2e vs preview URL (+ tenant-isolation suite)
                         └ Lighthouse CI on marketing routes
main ─► migrate (drizzle-kit migrate on Neon prod) ─► Vercel Production ─► Sentry release + source maps
```

- **Environments:** `local` (Neon dev branch or Docker Postgres), `preview` (per-PR Neon branch), `production`. Add `staging` only when there's a team to need it.
- **Migrations:** expand → migrate → contract. No destructive migration in the same deploy as the code that stops using a column.
- **Secrets:** Vercel env vars. Clerk/Stripe test keys in preview, live keys only in production.
- **Feature flags:** PostHog flags per org (`pro.projects`, `beta.xero`), combined with plan entitlements.
- **Quality gates:** no merge with failing type-check, unit tests or tenant-isolation tests. Visual regression (Playwright screenshots) on core `src/components/ui` stories.
- **Dependencies:** Renovate weekly. Next.js security patches applied within 48 h.
- **Backups:** Neon point-in-time restore (paid plan) + nightly logical dump to R2 (Inngest cron).

---

## 6. Delivery roadmap (priority order)

Each phase ends in something sellable. Phases line up with the pricing tiers on the site.

### Phase 0: Foundations (weeks 1–3)
1. Single-app structure with lint-enforced boundaries (`src/core`, `src/db`, `src/auth`), CI, Vercel + Neon + Clerk projects, Sentry, PostHog.
2. Design Guidelines tokens → `src/app/globals.css`. Geist fonts via `next/font`.
3. `src/components/ui`: install and restyle shadcn primitives (Button, Input, Select, Dialog, Popover, Command, Table, Tabs, Badge, Tooltip, Sheet, DropdownMenu, Toast/Sonner, Calendar). Build composites: `AppShell`, `Sidebar`, `TopBar`, `StatusPill`, `MoneyCell`, `KpiCard`, `EmptyState`, `BrowserFrame` (marketing screenshots).
4. ✅ Auth + orgs, Clerk webhooks → `organizations`/`members`, RLS + `withTenant`, tenant-isolation tests.
5. ✅ Company settings: profile, logo link, VAT number, default markup and VAT rate, terms. (Logo upload comes with file storage.)

### Phase 1: Quoting (Free tier). Private beta (weeks 4–9)
1. Clients (basic records).
2. **Service library**: services, bundles, categories, CSV import, usage counts.
3. **Quote builder**: sections, lines, keyboard grid, formula bar, per-line markup, notes and attachments, PC/provisional sums, live totals and margin, duplicate quote, autosave.
4. **Library autocomplete** in the grid (pg_trgm).
5. **Send**: immutable version snapshot, branded PDF, client link, email via Resend.
6. **Client quote page**: expandable sections, line comments, **accept and e-sign** (name + typed signature + audit record of hash, IP and timestamp), view tracking → activity feed ("opened 3×").
7. Marketing site v1 in `(marketing)`, built from the existing designs, with real app screenshots.
   **Exit:** 10 beta firms sending real quotes.

### Phase 2: Getting paid (Essentials £49). Public launch (weeks 10–15)
1. **Payment plans** on quotes (deposit / stages / retention, % or fixed), carried to the project on acceptance.
2. **Invoicing**: raise from stage, VAT (standard, reduced, domestic reverse charge), numbering, PDF, send, mark paid.
3. **Stripe Connect onboarding** + pay-by-link (card + Pay by Bank). Webhooks mark invoices paid.
4. **Automatic reminders** (Inngest): before due, on due, +3, +7 days, with polite templates from the Voice guide.
5. **Variations**: create (desktop + mobile), photos, send, client approve/reject in the portal, approved → added to next stage invoice.
6. **Billing & entitlements**: Stripe Billing, 14-day trial, plan gating middleware (`requirePlan('essentials')`), upgrade prompts, customer portal.
   **Exit:** paying customers on Essentials; public launch with Free + Essentials.

### Phase 3: Running the job (Pro £119) (weeks 16–26)
1. **Projects**: created from accepted quote (sections → task groups), kanban board (dnd-kit), timeline, files, site diary.
2. **Client portal**: same link becomes a project portal with progress photos, documents, variations and payments.
3. **Employees tab**: profiles, trades, day rates, certificates (CSCS, Gas Safe) with expiry reminders, schedule view.
4. **Employee app (PWA)**: today's site, tasks, check-in/out (geo-stamped), photo upload with **offline queue** (IndexedDB + background sync), push notifications (Web Push).
5. **CRM pipeline**: enquiries by stage and source, next-action reminders, web enquiry form embed for customers' own websites.
6. **Email automations**: trigger → condition → template (quote not opened in 3 days, quote opened but not signed, post-completion review request).
7. **Reporting**: dashboard KPIs, invoiced vs collected, win rate by source and job type, margin by job, cash-flow forecast from payment stages.
   **Exit:** Pro tier live; the full product shown on the marketing site exists.

### Phase 4: Scale and moat (after launch, ongoing)
- **Xero and QuickBooks sync** (invoices, payments, contacts). This is the most-requested integration in UK trades. Move it earlier if beta feedback demands it.
- **CIS** (Construction Industry Scheme) deductions for subcontractor payments.
- Native employee app (Expo) if PWA limits bite (background location, camera reliability on iOS).
- Customer custom domains for portals (`quotes.halesons.co.uk`) and sending from their email domain.
- Quote analytics (which sections clients dwell on), templates marketplace, public API + Zapier.
- Enterprise: SSO, audit export, granular permissions.

---

## 7. Things worth adding (not yet in the brief)

**Must-have before public launch**
1. **UK GDPR compliance**: London-region data, DPA for customers, sub-processor list, data export and deletion per tenant, retention policy for client photos. We're a processor for homeowners' data.
2. **Audit log**: who changed which price and when, and who signed what version. Essential when a variation or final account is disputed.
3. **Roles and permissions**: Owner / Office / Estimator / Site lead / Employee. Hide margins and cost prices from site staff.
4. **Quote versioning and revisions**: "Revised quote v2" with a diff for the client.
5. **Domestic reverse charge VAT and retention** handling in invoices.
6. **Import tools**: Excel/CSV price lists and client lists, plus a done-for-you import (promised on the Pricing page).
7. **Legal and trust**: terms, privacy, cookie consent (PostHog EU, cookieless where possible), status page, and **Cyber Essentials** certification (cheap, and UK SMBs recognise it).

**High value, soon after**
8. **Xero / QuickBooks** (see Phase 4). Many firms won't switch without it.
9. **Notification centre** (in-app + email + push) with per-user preferences.
10. **Offline-first site app** (Phase 3 covers photos; extend to tasks and diary).
11. **Help centre and in-app support** (e.g. Plain or Intercom), onboarding checklist, sample data workspace.
12. **Reviews loop**: after completion, ask the client for a review (Google / Checkatrade / Trustpilot link). It ties into the CRM.

**Later**
13. Supplier price lists and materials ordering, subcontractor portal, timesheets → payroll export, and AI helpers (draft a quote from site-visit notes or photos) once the core is boringly reliable.

---

## 8. Indicative running costs

| Stage | Monthly (approx.) |
|---|---|
| Build / private beta | ~£0–20 (Vercel Hobby→Pro, everything else on free tiers) |
| Launch (≤100 firms) | ~£60–150: Vercel Pro, Neon Launch (usage), Clerk free, Resend/Inngest free or low tiers, Sentry/PostHog free |
| 500 firms | ~£400–800: Clerk Pro + B2B add-on, Neon usage, R2 storage for photos, Inngest/Resend paid tiers |

Revenue at 500 firms with a 60/40 Essentials/Pro mix is ≈ £38k MRR, so infrastructure stays around 2% of revenue.

---

## 9. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Cross-tenant data leak | RLS + non-bypass DB role + `withTenant` + automated isolation tests on every PR |
| Quote grid performance with 300+ lines | Virtualised rows, patch-based autosave, totals computed incrementally in `src/core` |
| Clerk pricing or limits change | Auth behind `src/auth`; Better Auth migration path documented |
| iOS PWA limitations for site staff | Keep critical flows (check-in, photos) simple; Expo app in Phase 4 |
| Payments liability | Stripe Connect Express: funds go to contractor accounts, KYC handled by Stripe |
| Next.js security churn | Renovate + 48 h patch SLA, pinned minors, CSP headers, image-optimiser domain allow-list |
| E-signature disputes | Immutable version snapshot + SHA-256 hash + IP/time/user-agent in `signatures`, shown on PDF |

---

## 10. Open questions for the founders

1. Free plan limits on the site (3 quotes/month, 25 library items, 1 user) are placeholders. Confirm them.
2. Is "per company, unlimited users" final? It affects Clerk's org-member limits and whether to cap seats on Essentials.
3. Will we take a platform fee on client card payments, or pass through Stripe fees only?
4. Is Xero needed for launch, or is Phase 4 acceptable for the first customers?
5. Should client portals sit on `builderos.app` at launch, or do we need customer custom domains from day one?
