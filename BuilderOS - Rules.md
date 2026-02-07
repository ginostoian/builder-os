# BuilderOS \- Rules

You are an expert full-stack TypeScript engineer building BuilderOS.

**PRODUCT**

BuilderOS is a multi-tenant SaaS for UK renovation/design-and-build companies (£10k–£300k jobs).  
Core wedge: quoting \+ scope control \+ variations:  
Draft → Sent (editable \+ versioned) → Accepted (locks) → Variations (approved changes post-acceptance).  
Hybrid pricing, VAT toggle, deposit \+ payment schedule (informational), client web link \+ PDF export.

**LONG-TERM VISION (BuilderOS \= OS)**

BuilderOS will evolve into:  
\- Full CRM (pipelines/stages, lead aging, automations, follow-up sequences)  
\- Payment plan tool (client portal view, payment reminders, builder marks payments as received)  
\- Dashboards (leads, cashflow, receivables, company health)  
\- Project management module (tasks, milestones, documents, comms)  
IMPORTANT: Do NOT implement these future modules unless explicitly requested in the current milestone.  
Design MVP with clean extension points and consistent patterns so future modules can be added later.

**STACK (NON-NEGOTIABLE)**

\- Next.js App Router \+ TypeScript  
\- Clerk for auth \+ Organizations for tenancy  
\- Postgres \+ Prisma  
\- Tailwind \+ shadcn/ui  
\- Server Actions for mutations (NO tRPC)  
\- Prefer React Server Components for pages; Client Components only where needed (e.g., editable grid)  
\- Single repo (NO Turborepo)  
\- No platform payment collection. Never charge clients on behalf of builders. No Stripe payment flows in MVP.

**MULTI-TENANCY & SECURITY (CRITICAL)**

\- Tenant \= Clerk Organization (orgId).  
\- Every persisted record MUST include orgId (tenant id).  
\- Every DB read/write MUST be scoped by orgId (where: { orgId, ... }).  
\- Never trust orgId from client input; always derive orgId from Clerk auth context.  
\- Public quote links are unlisted token URLs; they must not leak internal-only fields (cost, markup, internal notes).  
\- Markup/cost are INTERNAL ONLY. Never rendered in client portal or PDFs.

**DATA MODEL PRINCIPLES**

\- Explicit schemas. Prefer clarity over abstraction.  
\- QuoteItem must support calcType:  
  \- sell\_only, unit\_rate, labour\_hours, allowance  
\- Store deterministic inputs to compute totals.  
\- Always maintain a clean separation:  
  \- Builder view (edit \+ internal details)  
  \- Client view (summary-first; optional expand; hides internal breakdown by default)

**LIFECYCLE RULES (STRICT)**

\- Quotes are editable until accepted.  
\- When a sent quote is edited and resent, increment version; client always sees latest; show “Updated on”.  
\- On acceptance: lock quote (read-only).  
\- After acceptance: quote cannot be edited; all changes are Variations only.  
\- Variations cannot exist before acceptance.  
\- Approval records are immutable audit events.

**VAT / DEPOSITS / PAYMENT PLANS (IMPORTANT)**

\- VAT is per quote: 0% or 20%. Compute subtotal, VAT amount, total.  
\- Deposit required toggle: either fixed £ amount or % of total. Informational only (no payments collected).  
\- Payment plans are informational schedules; later we will add reminders and “mark as paid” actions, not card payments.

**SERVER ACTIONS RULES**

\- Use server actions for create/update/delete flows.  
\- Validate inputs with Zod in server actions.  
\- Never mutate data in client components; client components call server actions.  
\- Use clear action names and place them near the module:  
  /modules/quotes/actions.ts  
  /modules/variations/actions.ts  
\- Every action must:  
  1\) resolve orgId from Clerk  
  2\) validate input  
  3\) enforce lifecycle rules  
  4\) scope queries by orgId  
  5\) return typed results  
  6\) revalidatePath / revalidateTag appropriately

**UX PRINCIPLES**

\- Quote builder \= spreadsheet-like grid, keyboard-first.  
\- Client quote page \= summary-first with expandable sections.  
\- Default client view hides quantities and unit rates; builder can toggle per quote.  
\- Terms & Conditions \= rich text set at org level, overridable per quote, rendered on web \+ PDF.  
\- Provide share tools: copy link, download PDF, copy email/WhatsApp text. (Platform email sending is optional later.)

**ENGINEERING PRACTICES**

\- Build vertical slices: schema → action → UI.  
\- Avoid premature abstractions.  
\- Add guardrails: enforce tenant scoping and lifecycle transitions.  
\- Keep code maintainable: small files, consistent naming, predictable folder structure.  
\- When you add features, include:  
  \- file paths  
  \- exact code blocks per file  
  \- migration notes for Prisma changes  
  \- minimal tests for pure business logic where feasible

**CURRENT MILESTONE (MVP)**

Implement:  
\- Org-scoped company settings (branding, defaults, rich-text terms)  
\- Clients CRUD (light)  
\- Quotes CRUD with QuoteItems, hybrid pricing, VAT toggle  
\- Price book \+ template sections insertion  
\- Public quote link (unlisted), summary-first  
\- PDF generation  
\- Quote versioning  
\- Online acceptance \+ locking  
\- Variations \+ approvals \+ variation PDFs  
Do NOT implement full CRM, automations, payment reminders, dashboards, or project management yet.  
Leave clean extension points only.

