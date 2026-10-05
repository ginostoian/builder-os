/**
 * The legal facts the privacy and cookie policies rely on. Check each one before launch: the company
 * number, registered office and ICO registration number below must match Companies House and the ICO
 * register exactly.
 */
export const LEGAL = {
  company: "Builder OS Ltd",
  /** Companies House number. TO CONFIRM before launch. */
  companyNumber: "to be confirmed",
  /** Registered office address. TO CONFIRM before launch. */
  registeredOffice: "Bristol, United Kingdom",
  /** ICO data protection fee registration number. TO CONFIRM before launch. */
  icoNumber: "to be confirmed",
  privacyEmail: "privacy@builderos.co.uk",
  supportEmail: "hello@builderos.co.uk",
  /** Shown as "last updated" on the policies. Change it whenever they change. */
  updated: "5 October 2026",
} as const;

/**
 * Who processes personal data for us (sub-processors), where, and why. Keep in step with the integrations
 * actually switched on (docs/integrations.md).
 */
export const SUBPROCESSORS: { name: string; purpose: string; location: string }[] = [
  { name: "Vercel", purpose: "Hosting the app and website", location: "UK and EU (London region), with US-based support" },
  { name: "Neon", purpose: "Database", location: "EU or UK region, as configured" },
  { name: "Clerk", purpose: "Sign-in and team accounts", location: "United States" },
  { name: "Resend", purpose: "Sending email (quotes, invoices, reminders, sign-in codes)", location: "United States and EU" },
  { name: "Bunny.net", purpose: "Storing and serving files (logos, photos, documents, receipts)", location: "United Kingdom (London storage), global CDN" },
  { name: "Stripe", purpose: "Subscription billing, and card or bank payments of invoices for companies that switch them on", location: "United States and EU" },
  { name: "Anthropic", purpose: "Reading receipt photos into expense details, when a company uses it", location: "United States" },
  { name: "Sentry", purpose: "Error monitoring (no names, emails or cookies are sent)", location: "United States or EU, as configured" },
];
