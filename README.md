# Builder OS

The operating system for UK renovation companies: spreadsheet-fast quoting, client sign-off, stage payments and invoicing, with projects, team and pipeline in the same place.

This repo holds the marketing site and the app UI, built from the Claude Design handoff in `project/` (design prototypes) and `chats/` (the design conversation). Sign-in, companies, roles and company settings run on Clerk and Postgres. The other app screens still show typed demo data. Payments come next. See `docs/technical-implementation-plan.md`, `docs/auth.md` and `docs/database.md`.

## Run it

```bash
pnpm install
cp .env.example .env.local   # then fill in Clerk test keys and a local Postgres (docs/database.md)
pnpm db:migrate
pnpm dev          # http://localhost:3000 — the marketing site works without any of the above
pnpm test         # domain logic, roles, validation, webhook signatures (vitest)
pnpm test:db      # tenant isolation and Clerk sync against real Postgres (see docs/database.md)
pnpm typecheck && pnpm lint && pnpm build
```

CI (`.github/workflows/ci.yml`) runs all of these on every pull request, with a Postgres 16 service.

## What's where

| URL | What | Source |
|---|---|---|
| `/` | Home | `src/app/(marketing)/page.tsx` |
| `/features` | One section per module | `src/app/(marketing)/features` |
| `/pricing` | Plans, comparison table, FAQs | `src/app/(marketing)/pricing` |
| `/blog`, `/blog/[slug]` | Blog with category filter and search, article | `src/app/(marketing)/blog` |
| `/customers` | Customer stories with filter | `src/app/(marketing)/customers` |
| `/about` | About, team, contact form | `src/app/(marketing)/about` |
| `/demo` | Book a demo calendar | `src/app/(marketing)/demo` |
| `/design-guidelines` | Design system (internal, not indexed) | `src/app/design-guidelines` |
| `/sign-in`, `/sign-up` | Clerk sign-in and sign-up | `src/app/(auth)` |
| `/select-company` | Create or choose a company | `src/app/(auth)/select-company` |
| `/app` | Dashboard / reporting | `src/components/app/screens/dashboard.tsx` |
| `/app/quotes/Q-1042` | Quote builder (editable grid) | `src/components/app/screens/quote-builder.tsx` |
| `/app/library` | Service library | `src/components/app/screens/service-library.tsx` |
| `/app/projects/elm-road` | Project board (drag cards between columns) | `src/components/app/screens/project-board.tsx` |
| `/app/payments` | Payment plan + invoices | `src/components/app/screens/payments.tsx` |
| `/app/clients` | CRM pipeline | `src/components/app/screens/pipeline.tsx` |
| `/app/settings` | Company settings (Admin edits) | `src/components/app/settings` |
| `/app/settings/team` | Members, invitations, roles | `src/components/app/settings/team-settings.tsx` |
| `/q/hale-sons/1042` | Client-facing quote link (accept & sign) | `src/components/app/screens/client-quote.tsx` |
| `/m` | Employee app (phone) | `src/components/app/screens/employee-app.tsx` |

## How it fits together

- **One source of demo data.** `src/lib/demo-data.ts` feeds every app screen. Marketing screenshots (`src/components/app/screenshot.tsx`) render the real screens at 1280×800 and scale them down, so changing a screen or a figure updates every screenshot.
- **Domain logic.** `src/core` holds money, quote maths, limits and the Zod schemas for every input. It's pure TypeScript: lint stops it importing React, Next or the database. Money is integer pence and basis points throughout, and all totals come from `src/core/quote.ts`.
- **Auth.** Clerk Organizations, behind `src/auth`: `getSession()` gives the user, company and role, and `withSession()` runs queries in that company. `/app` and `/m` need a signed-in user in a company; employees only get `/m`. See `docs/auth.md`.
- **Database.** `src/db` holds the Drizzle schema, migrations and `withTenant()`, the only way to query. Every table is isolated per company by Postgres RLS. See `docs/database.md`.
- **Design tokens.** `src/app/globals.css` is the Tailwind v4 + shadcn theme from the Design Guidelines. `/design-guidelines` prints this file, so the docs can't drift from the code.
- **Components.** shadcn-style primitives in `src/components/ui` (restyled Button, Badge, Input, Accordion, Dialog…), brand pieces in `src/components/brand.tsx`, app shell in `src/components/app/app-shell.tsx`.

## Placeholders to replace before launch

The founder note, customer names and results, testimonials, team, contact details, blog posts and photos (striped boxes) are all placeholders from the design. Free plan limits and the 14-day trial are unconfirmed. Only the featured article has a body; other blog cards link to it until posts move to MDX.
