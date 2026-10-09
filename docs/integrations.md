# Integrations

All are optional. Without them the app still works: sending gives you a link to share yourself, and the logo is a link instead of an upload.

## Email: Resend

Used for quote and invoice emails to clients (with their portal link), automatic payment reminders, and alerts to your team when a client opens, comments on, accepts or declines a quote.

1. Create a Resend account, add your sending domain, and add the DNS records it gives you (SPF/DKIM).
2. Create an API key with "sending access".
3. In Vercel (Production, and Preview if you want previews to send real email):
   - `RESEND_API_KEY`: the key.
   - `EMAIL_FROM`: a verified address, e.g. `Builder OS <quotes@yourdomain.co.uk>`.
   - Optionally `APP_URL`: your production URL (links in emails). On Vercel it defaults to the production domain; anywhere else it must be set in production.

How messages look:
- Every message uses one template (`src/core/email-template.ts`): the company's name and brand colour, a heading, a button, and a plain-text version.
- Mail comes from the `EMAIL_FROM` address under the company's name, so clients see "Hale & Sons".
- Replies go to the team member who sent the quote.
- Team alerts go to whoever sent the quote, or to the company's Admins if that person has no email address. A client opening a quote triggers an alert only the first time they open each version.

Code: `src/server/email.ts` (sending), `src/server/notify.ts` (team alerts), `src/core/invoice-email.ts` (invoice and reminder wording).

## Payment reminders: Vercel Cron

Clients get an email about an unpaid invoice 3 days before it's due, on the day, then 3 and 7 days late. Each reminder goes out once at most. Reminders stop when the invoice is marked paid or cancelled, and a company can switch them off in Settings → Payments.

The same daily job also tells admins and office about team certificates (CSCS, Gas Safe, insurance) that expire within 30 days or have already expired: in the notification bell always, and by email when email is set up. Each certificate is mentioned once, until its date changes.

It also sends the sales pipeline's automation emails that are due that day. Same-day ones go out straight away, when the lead is added or moves stage. Each automatic email carries:
- an unsubscribe link (`/unsubscribe/{token}`);
- one-click `List-Unsubscribe` headers (`POST /api/unsubscribe/{token}`).

Leads who unsubscribe get no more automatic emails. Emails due while email wasn't set up are skipped once they're more than 3 days late, rather than sent late.

The day before each survey visit, the client gets a reminder with a link to move or cancel it.

The web enquiry form (`/enquire/{token}`, or embedded with `?embed=1`) needs nothing extra. It sends new enquiries into the pipeline and emails admins and office (once email is set up).

1. Generate a long random secret: `openssl rand -hex 32`.
2. In Vercel (Production only), set `CRON_SECRET` to it. Vercel Cron sends it as `Authorization: Bearer …`.
3. Email must be set up as above. Without `CRON_SECRET`, `/api/cron/reminders` answers 503.

The schedule is in `vercel.json` (08:00 UTC daily, which is 08:00 or 09:00 in the UK). To run it by hand:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<your-domain>/api/cron/reminders
```

It returns `{ companies, sent, failed, skippedNoEmail }`.

How it works:
- A `SECURITY DEFINER` lookup (`app_orgs_with_due_invoices`) finds companies with unpaid invoices due within 3 days. It returns company ids only.
- Each company is then handled inside its own tenant transaction.
- Each reminder is recorded (`invoice_reminders`) before the email is sent, so overlapping runs can't double-send. If Resend refuses one, that reminder is skipped rather than retried.

Code: `src/server/reminders.ts`, `src/app/api/cron/reminders/route.ts`.

## File storage: Bunny.net

Used for company logos, site and variation photos, project files and receipts.

1. In Bunny: create a **Storage Zone**. The region should be London (`uk`) to keep data in the UK.
2. Connect a **Pull Zone** to it. Its hostname (`https://….b-cdn.net`, or a custom one) is the CDN URL.
3. Leave this pull zone's **Security** settings open (for private files, add a second zone: see Private files below): **Token Authentication off**, no "Allowed referrers", and "Block no referrer" unticked. The app links to files directly (their names are long and random, so they can't be guessed), and any of those settings makes photos show as broken even though they uploaded.
4. In Vercel:
   - `BUNNY_STORAGE_ZONE`: the zone name.
   - `BUNNY_STORAGE_KEY`: Storage Zone → FTP & API Access → Password.
   - `BUNNY_STORAGE_HOST`: `uk.storage.bunnycdn.com` for London. The default is `storage.bunnycdn.com`, which is Falkenstein.
   - `BUNNY_CDN_URL`: the pull zone URL. It must be `https://`.

How files are handled:
- Files are stored under `orgs/{companyId}/…` with random names, so a new upload always gets a new URL.
- Uploads are checked by their actual bytes (PNG, JPEG or WebP) and size. SVG is refused because it can carry scripts.
- Replacing or removing a logo deletes the old file.

If an upload fails with "The file couldn't be stored", the message ends with a code:
- **storage error 401**: Bunny refused the password, or the region is wrong.
  - `BUNNY_STORAGE_KEY` must be the zone's **Password** (FTP & API Access). It isn't the read-only password or the account API key.
  - `BUNNY_STORAGE_HOST` must match the zone's main region, e.g. `uk.storage.bunnycdn.com` for London, `storage.bunnycdn.com` for Falkenstein.
- **storage error 404**: the zone name is wrong. `BUNNY_STORAGE_ZONE` is the zone's name exactly as Bunny shows it.
- **storage unreachable**: the host name doesn't exist. It should look like `uk.storage.bunnycdn.com`.

**Uploads work but photos show as broken?** Go to Settings → Company → **Check file storage**. It uploads a test photo, fetches it back through your CDN link, and says what to change:
- **error 403**: Token Authentication or hotlink protection is on in the pull zone (step 3).
- **can't find files**: the pull zone isn't connected to this storage zone, or `BUNNY_CDN_URL` is another pull zone.
- **takes a few seconds**: normal. A just-uploaded photo can take a moment to reach the CDN, and the app shows your own copy and retries until it does.

Vercel's logs (Logs, filter "Bunny") show the same explanation for failed uploads. Settings pasted with spaces, a trailing slash or an `https://` prefix are tidied automatically. After changing a setting, redeploy.

Code: `src/server/storage.ts`, `src/core/files.ts`.

## Reading receipts: Claude (optional)

With an Anthropic API key, picking a receipt photo or PDF (office expense form, or "Add a receipt" in the site app) fills in the shop, what was bought, the date, the total and the VAT. People check it before saving; anything they've already typed is kept. Without the key, the forms work as before.

1. Create an API key at console.anthropic.com (Settings → API keys) and add some credit.
2. In Vercel, set `ANTHROPIC_API_KEY` (Production and Preview), then redeploy.

Each receipt is one request to Claude (`claude-opus-5-5`, low effort); the photo is shrunk in the browser first. If Claude declines a request, the API retries it on a fallback model (`fallbacks: "default"`). Nothing is stored by the reader itself: the file is sent once to read it, and uploaded to Bunny as usual when the expense is saved.

Code: `src/server/receipt-reader.ts`, `src/app/receipt-actions.ts`, `src/components/receipt-reader.ts`.

## Client portal sign-in

With email set up, the client portal asks clients to confirm their email the first time they open it on a new phone or computer (a 6-digit code, emailed). The device is then remembered for 90 days. Buttons in quote, variation and invoice emails sign them in with one tap: each link works once, within a week. Clients can always find their portal at `/portal` by entering their email address; put it on the company website as "Client login".

- It needs email (`RESEND_API_KEY`, `EMAIL_FROM`). Without it, the private link alone opens the portal, as before.
- Clients with no email address on file also open it with the link alone.
- Admins can turn it off in Settings → Company → Client portal sign-in. On a client's page, "Sign out everywhere" ends every remembered device.

## Online survey booking

Turn it on under Pipeline → Online booking. Set how long a visit takes, the travel time between visits, notice, how far ahead people can book, and (optionally) the postcode areas you cover. Then give each surveyor their weekly hours.

- After the web enquiry form, people in your areas can book straight away.
- Add `{{booking_link}}` to an automation email, or copy the booking link from a lead's page, to invite anyone else.
- The client gets a confirmation with a calendar invite (`.ics`), and a reminder the day before (from the daily job). They can move or cancel it from the same link.
- The surveyor gets a notification. The visit shows on the lead, in the calendar and in their site app (with directions and a call button).
- The office can move or cancel any visit from the lead's page, or book one at any time with anyone.

## Plans and online payments: Stripe

Two separate things, both through Stripe:
- **Plans.** Companies subscribe to Essentials (£49 a month) or Pro (£119 a month), plus VAT, by Stripe Checkout, and manage cards, invoices and cancelling in Stripe's billing portal (Settings → Plan & billing). New companies get 14 days of Pro with no card; after that, without a subscription, they're on Free: 3 sent quotes a month, 25 library items, 1 user, quote links and e-signature. Screens their plan doesn't include show what it would unlock instead.
- **Clients paying invoices online.** Each company connects its own Stripe account (Settings → Payments → Take payments online, Stripe Express). Invoice emails and the portal then get a "Pay now" button. The money goes straight to the company's account (a direct charge); Builder OS takes no fee. The invoice is marked paid automatically and admins and office are notified. Bank transfer still works as before.

Setup:
1. In Stripe, set up Connect (Platform, Express accounts, UK).
2. With `STRIPE_SECRET_KEY` in `.env.local`, run `pnpm stripe:setup`. It creates the two products and their monthly GBP prices (found by lookup keys `builderos_essentials_monthly` and `builderos_pro_monthly`, so no price ids to copy) and a billing portal configuration. Run it once in test mode and once with the live key.
3. Add two webhook endpoints, both to `https://<your-domain>/api/webhooks/stripe`:
   - **Your account:** `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `customer.subscription.paused`, `customer.subscription.resumed`, `checkout.session.completed`.
   - **Connected accounts:** `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `account.updated`, `charge.refunded` (a full refund marks the invoice unpaid again; a part refund just tells the office).
4. In Vercel:
   - `STRIPE_SECRET_KEY`: the secret (or restricted) key.
   - `STRIPE_WEBHOOK_SECRET`: the signing secret of the "your account" endpoint.
   - `STRIPE_CONNECT_WEBHOOK_SECRET`: the signing secret of the "connected accounts" endpoint.
   - Optional `STRIPE_PORTAL_CONFIGURATION`: the id `pnpm stripe:setup` printed (otherwise your default portal settings are used).
   - Optional `STRIPE_AUTOMATIC_TAX=1` once Stripe Tax is set up with your VAT registration.
   - `PLATFORM_ADMIN_EMAILS`: comma-separated emails of the website owner's team. They get the owner admin area at `/admin`, outside every company (a gauge icon by their name in the app links to it): customers by plan, MRR and its movements, churn, trial conversion, daily and monthly active users, and each company's usage, with complimentary Pro switches. It checks the signed-in user's verified email, then asks for a code from an authenticator app (Google Authenticator, Microsoft Authenticator and so on), so it has two-step verification on Clerk's free plan. The first visit shows a QR code to scan; after that the code is asked for every 12 hours on each browser (or sooner with Lock admin). The key is kept in the Clerk user's private metadata (`adminTotp`), which only our server can read. Lost phone: in the Clerk dashboard open the user, Metadata, Private, delete `adminTotp`, and set the app up again at `/admin`. Set it up as soon as you add yourself, so nobody else can. A login with Clerk's own two-step (paid plans) skips the code. Set `PLATFORM_ADMIN_ALLOW_NO_2FA=1` only in development. Everyone else gets a 404. It works without Stripe too.
5. Payment methods for clients (card, Pay by Bank, Apple Pay and so on) follow the platform's Connect payment method settings in Stripe.

Without `STRIPE_SECRET_KEY`, the plan page shows plans but can't take payment, and online invoice payments stay off.

How it works:
- Webhooks are verified with either signing secret. The app doesn't trust the event body: it re-fetches the subscription or account from Stripe and stores what Stripe says. Returning from Checkout does the same, so the page is right even before the webhook lands.
- A client payment is accepted only if the connected account is the company's own and the amount equals the invoice. The same payment twice changes nothing.

Code: `src/core/plans.ts` (plans and features), `src/server/stripe.ts`, `src/server/stripe-events.ts`, `src/app/api/webhooks/stripe/route.ts`, `src/db/billing.ts`, `scripts/stripe-setup.ts`.

## Private files: expiring links (recommended)

By default, photos, project files and receipts are served from the same CDN links as logos. Those links are long and random, so they can't be guessed, but anyone who has one can open it for good. To make private files open only through links that expire (after 12 hours; pages hand out fresh ones each time they load):

1. In Bunny, add a **second pull zone** on the same storage zone, e.g. `builderos-private`. Under Security, turn on **Token Authentication** and copy its key.
2. On the **first** (public) pull zone, add an Edge Rule that blocks every request whose path doesn't match `/orgs/*/logo/*`. Logos stay public, because they go out in emails and on quotes; nothing else can be fetched through that zone.
3. In Vercel, set `BUNNY_PRIVATE_CDN_URL` to the private zone's URL and `BUNNY_TOKEN_KEY` to its key, then redeploy.

Photos frozen into variations that were already sent are re-signed when the page is shown, so they keep working.

## Error monitoring: Sentry

Crashes in pages, server actions, API routes and the browser are reported to Sentry, along with our own logged failures (an email that couldn't be sent, a sync that failed). Sentry emails you about each new problem, usually before a customer notices.

1. Create a Sentry project (platform: Next.js). If you want, choose its EU data region.
2. In Vercel, set `NEXT_PUBLIC_SENTRY_DSN` (and `SENTRY_DSN`, the same value) to the project's DSN.
3. Optional, for readable stack traces: `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` and `SENTRY_PROJECT` let builds upload source maps.
4. In Sentry, check Alerts → "Send a notification for new issues" goes to you.

No personal data is sent: no user details, cookies, headers, request bodies or query strings, and portal, booking and unsubscribe tokens in page addresses are masked (`src/lib/monitoring.ts`). Browser reports go through our own `/monitoring` route, so ad blockers don't drop them. Without a DSN, nothing is sent.

## Uptime

- `GET /api/health` answers 200 with `{ ok: true }` when the app is up and can reach its database, and 503 when it can't. Point an uptime monitor at it (Better Stack, UptimeRobot or similar; every minute, alert by email or SMS).
- **Daily job heartbeat.** Create a heartbeat check in the same monitor (expect one ping a day, with a few hours' grace) and set `CRON_HEARTBEAT_URL` to its URL. The daily job pings it when it finishes, so you hear if reminders stop going out.
- **Free backstop.** The GitHub workflow `.github/workflows/uptime.yml` checks `/api/health` and the home page every 10 minutes. Set the repository variable `PRODUCTION_URL` (Settings → Secrets and variables → Actions → Variables). A failed run emails whoever last changed the workflow.

## Search engines (SEO)

The public website is set up for Google with nothing to install:

- `/sitemap.xml` lists every public page (home, features, pricing, free tools, help articles, blog, legal pages). `/robots.txt` keeps crawlers out of the app, site app, admin, client portal and other private links, and points them at the sitemap. Preview deployments ask not to be crawled at all.
- Every public page has a title, description, canonical link (always the live address) and a share card (`opengraph-image` files: a default one, plus one for the tools hub and each tool). The favicon is `src/app/icon.tsx`.
- Structured data (schema.org JSON-LD, built in `src/lib/seo.ts`): Organization, WebSite and SoftwareApplication with each plan as an offer on the home page; FAQ and offers on pricing; TechArticle and breadcrumbs on help articles; BlogPosting on the blog; WebApplication, breadcrumbs and FAQ on every free tool.
- Optional `NEXT_PUBLIC_SITE_URL` changes the address used in all of the above (it defaults to `https://builder-os.co.uk`).
- Google Search Console: add the domain (the DNS method needs no code), then submit `https://builder-os.co.uk/sitemap.xml`. To use the HTML tag method instead, set `GOOGLE_SITE_VERIFICATION` to the tag's content value and redeploy.

Free tools live at `/tools` (`src/lib/content/tools.ts` lists them; the sums are in `src/core/tools`, with tests). To add one: add it to `TOOLS`, write its sums in `src/core/tools` with tests, its calculator in `src/components/tools`, and a page plus `opengraph-image.tsx` under `src/app/(marketing)/tools/<slug>`. It then appears in the hub, footer, sitemap and "more free tools" automatically. Tax figures (CIS rates, the reverse charge rules, the £90,000 VAT threshold) are as of October 2026: check them when HMRC changes the rules and update each tool's `updated` date.

## Security settings

- `APP_SECRET`: a long random value (`openssl rand -hex 32`) that signs public form tokens and keys the rate-limit counters. Without it, one is derived from `CLERK_SECRET_KEY`. If you set it later, open forms need a reload.
- **Rate limits and bots.** Public forms and actions are rate-limited per visitor (IP address) and per target (email address): enquiries, "find my portal", sign-in codes and links, bookings, portal comments and decisions, paying online, and reading receipts. Counters live in Postgres (`rate_limits`) and only hold hashes. The enquiry form and "find my portal" also carry a signed token from when the page was served. Instant or forged submissions, the hidden honeypot field, and messages full of links are dropped quietly, without telling the bot.
- **Headers.** Every response sends HSTS, `X-Content-Type-Options: nosniff`, a strict referrer policy and a permissions policy. Pages can't be framed by other sites, except the web enquiry form, which is meant to be embedded.
- In production, links in emails always use `APP_URL` (or Vercel's production domain), never the request's host.

## Privacy (UK GDPR)

- `/privacy` and `/cookies` are linked from the site footer. Builder OS sets only strictly necessary cookies; a one-time notice says so.
- **Before launch**, check the company details in `src/lib/content/legal.ts`: company number, registered office and ICO registration number. Also check the sub-processor list matches the services you've switched on.
- Admins can download everything their company holds from Settings → Company → **Export all data** (a ZIP of JSON and CSV files). Any client's data, for answering their request, comes from **Export data** on that client's page. Exports leave out sign-in codes and sessions, and blank any token or secret. Spreadsheet cells can't run as formulas.
