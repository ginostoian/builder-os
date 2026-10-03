# Integrations

Both are optional. Without them the app still works: sending gives you a link to share yourself, and the logo is a link instead of an upload.

## Email: Resend

Used for quote emails to clients (with their portal link), and alerts to your team when a client opens, comments on, accepts or declines a quote. Coming next: invoice emails and payment reminders.

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

Code: `src/server/email.ts` (sending), `src/server/notify.ts` (team alerts).

## File storage: Bunny.net

Used for company logos now. The same module is ready for client documents and photos.

1. In Bunny: create a **Storage Zone**. The region should be London (`uk`) to keep data in the UK.
2. Connect a **Pull Zone** to it. Its hostname (`https://….b-cdn.net`, or a custom one) is the CDN URL.
3. For private files later: enable **Token Authentication** on a pull zone and copy its key.
4. In Vercel:
   - `BUNNY_STORAGE_ZONE`: the zone name.
   - `BUNNY_STORAGE_KEY`: Storage Zone → FTP & API Access → Password.
   - `BUNNY_STORAGE_HOST`: `uk.storage.bunnycdn.com` for London. The default is `storage.bunnycdn.com`, which is Falkenstein.
   - `BUNNY_CDN_URL`: the pull zone URL. It must be `https://`.
   - Optionally `BUNNY_TOKEN_KEY`, for signed private links.

How files are handled:
- Files are stored under `orgs/{companyId}/…` with random names, so a new upload always gets a new URL.
- Uploads are checked by their actual bytes (PNG, JPEG or WebP) and size. SVG is refused because it can carry scripts.
- Replacing or removing a logo deletes the old file.

Code: `src/server/storage.ts`, `src/core/files.ts`.
