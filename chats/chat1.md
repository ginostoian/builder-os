# Construction management software design

_Started 2026-10-01 19:01 UTC_

---

## User

We're building a website for construction companies in the UK market. It's a company management software that is meant to help streamline operations for small and medium renovation companies.

It's core services are going to be:
- Quoting tool: excel like system that will allow companies to easily create quotes, add notes to services, have the quotes as links and these can also be exported as pdf, they can add template services in a gallery which they can choose from and then modify the price if needed (look at companies like Houzz to se similar software. We need to make it better)
- Variations - variations quickly captured in the app by the admin side and sent via link or notification to client portal where they can accept or reject it
- Client portal - admins can upload progress photos
- payment plans
- invoicing module
- project management module like Houzz or Trello or something similar
- employees tab where they can keep track of employees
- Employee portal where they can see tasks asigned to them etc
- reporting
-CRM


I want the design system to be modern software, non ai slop, beautiful like cal.com aesthetic. Professional and reliable. 

Design the marketing site, add screenshots of the app, add pricing page, blog with filters, articles, create a couple of inside the app screens as well

## Assistant



## Assistant

_[tool: read_skill_prompt]_

_[tool: ask_user]_

I've put up a short form above. Answer what you can, or skip anything and I'll decide, and I'll start building once you submit it.

## User

Answered — name: Builder OS
You decide the tag line

Also create a Logo and app screenshots taken from your own designs of the internal design; pages: Home, Features (per module), Pricing, Blog index with filters, Blog article, Customer stories, About / Contact, Book a demo; app_screens: Quote builder (spreadsheet), Service template gallery, Client-facing quote link, Project board (kanban), Payment plan + invoicing, Employee portal (mobile), Dashboard / reporting, CRM pipeline; hero_focus: Quoting first — win more jobs, faster; pricing: Free plan + paid tiers; pricing_detail: access to quotin…

## Assistant

_[tool: update_todos]_

_[tool: dc_write]_

_[tool: show_html]_

_[tool: show_html]_

_[tool: dc_html_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_write]_

_[tool: dc_write]_

_[tool: dc_write]_

_[tool: dc_write]_

_[tool: show_html]_

_[tool: multi_screenshot]_

_[tool: dc_html_str_replace]_

_[tool: dc_write]_

_[tool: dc_write]_

_[tool: dc_write]_

_[tool: dc_js_str_replace]_

_[tool: dc_write]_

_[tool: dc_write]_

_[tool: dc_write]_

_[tool: dc_write]_

_[tool: update_todos]_

_[tool: ready_for_verification]_

I've built the Builder OS marketing site and the in-app screens; it's open on the Home page. The checker is still running in the background, so the pages haven't been checked yet.

**Marketing pages:** Home, Features (one section per module), Pricing, Blog, Article, Customers, About/Contact and Book a demo. The nav and footer link them all together.

- **Home** has tabs that switch between the app screens.
- **Pricing** has a comparison table and expandable FAQs.
- **Blog** has working category filters and search.
- **Book a demo** has a working calendar: pick a day and time, fill in your details, and see a confirmation.

**App screens:** quote builder, service library, the quote link a client sees, project board, payments and invoices, CRM pipeline, dashboard, and the employee mobile app. The sidebar switches between them. The screenshots on the marketing pages are these same screens shrunk down, so changing an app screen updates every screenshot of it.

**Logo:** a black square built from three bars like stacked bricks, with an orange bottom bar, plus "Builder OS" in type.

Things to know:
- **Made-up content:** the founder note, the customer names and their results, the testimonials, the team and the contact details are all placeholders. Replace them before anything goes live.
- **Pricing:** I described it as one price for the whole company rather than per user. The Free plan limits (3 quotes a month, 25 library items, 1 user) and the 14-day trial are my guesses. Send me the real terms and I'll update them.
- **Photos:** every image is a striped box labelled with what should go there.

## User

Found issues — fixing…

## Assistant

_[tool: dc_js_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: ready_for_verification]_

I fixed the two problems on the client quote screen:

- **Totals now add up:** the line items were showing prices with VAT while their section totals showed prices without it. All the figures in the sections are now without VAT, so the lines add up to their section total. The headline total in the sidebar still includes VAT.
- **Header line:** "James Hale · Valid until 5 Nov 2026" no longer wraps onto two lines.

The page reloads with no errors; I didn't re-run the full check for these two small fixes.

## User

i need you to create 2 separate documents.

1. Design Guideline
This should be the design system of the company. Colours, typography, copy tone. Everything that will help keep anyone up to speed with the app.

2. Technical implementation plan

Builder OS does not currently exist. Based on what we talked about, and on our design, build an md file laying out the app architecture, build pipeline, priority of items to be built in order to get to the actual final working product diplayed on the marketing website.

Stack will be Latest NextJS, carefully choose an auth provider considering the fact that we will have multi tenancy, choose the DB carefully. We need generous free tiers but also scalability and reliability. I want everything to be built as components using ShadCN and designed to look like the design we've made. anything else that we should add?

## Assistant

_[tool: dc_write]_

_[tool: web_search]_

_[tool: web_search]_

_[tool: web_search]_

_[tool: web_search]_

_[tool: web_search]_

_[tool: snip]_

_[tool: write_file]_

_[tool: ready_for_verification]_

I've written both documents. A background check of the Design Guidelines page is still running.

**1. `Design Guidelines.dc.html`** covers the logo and its usage rules, the colours, type, spacing, corner radius and shadows, and the core components. It also sets out:
- **Rules:** icons and imagery, and UK formats for money, dates and VAT.
- **Copy tone:** voice principles plus a "write this, not this" table.
- **Motion and accessibility** guidance.
- **ShadCN theme:** a ready-to-paste `globals.css` block, so every ShadCN component picks up the Builder OS look.

**2. `Technical Implementation Plan.md`** covers the stack, architecture, data model, build pipeline, a phased roadmap and running costs. The main choices:
- **Next.js 16.3 (current long-term support line).** 16.3.8 (Active LTS) came out on 30 September to fix security issues. Pin the version and apply security patches within 48 hours.
- **Clerk for login and companies.** Each company is a Clerk "Organization", and the plan includes a comparison with WorkOS, Better Auth and Supabase. The Free plan includes 100 monthly retained organizations (MROs) with up to 20 members per organization. Beyond that, the B2B Authentication Add-on costs $1 per MRO, with your first 100 MROs free. That cost is small next to £49–£119 per company. Homeowners get secure links rather than accounts, so they never count towards those limits.
- **Neon Postgres in London.** Projects in the London region keep your data within the United Kingdom. The free tier gives 0.5 GB of storage per project, 100 CU-hours of compute per project each month. Each company's data is kept separate at the database level, with automated tests on every change to prove one company can't see another's.
- **Roadmap:** the phases line up with your pricing tiers. Foundations, then Quoting (Free), then Getting paid (Essentials), then Running the job (Pro), then integrations.

**What else to add:** the plan's section 7 lists recommendations. The biggest are:
- Xero / QuickBooks sync. Many UK firms won't switch without it.
- UK GDPR basics: data processing agreements, data export and deletion.
- An audit log and quote version history, for disputed variations and final accounts.
- Role permissions that hide margins and cost prices from site staff.
- Reverse-charge VAT and retention on invoices.
- CIS deductions for subcontractor payments.
- Cyber Essentials certification, which UK small firms recognise.

The plan ends with 5 open questions for you, including the Free plan limits, which are still my placeholders.

