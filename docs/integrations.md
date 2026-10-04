# Integrations

Both are optional. Without them the app still works: sending gives you a link to share yourself, and the logo is a link instead of an upload.

## Email: Resend

Used for quote and invoice emails to clients (with their portal link), automatic payment reminders, and alerts to your team when a client opens, comments on, accepts or declines a quote.

1. Create a Resend account, add your sending domain, and add the DNS records it gives you (SPF/DKIM).
2. Create an API key with "sending access".
3. In Vercel (Production, and Preview if you want previews to send real email):
   - `RESEND_API_KEY`: the key.
   - `EMAIL_FROM`: a verified address, e.g. `Builder OS <quotes@yourdomain.co.uk>`.
   - Optionally `APP_URL`: your production URL (links in emails). It defaults to the request's host.

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
3. Leave the pull zone's **Security** settings open: **Token Authentication off**, no "Allowed referrers", and "Block no referrer" unticked. The app links to files directly (their names are long and random, so they can't be guessed), and any of those settings makes photos show as broken even though they uploaded.
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
