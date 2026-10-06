/**
 * Error monitoring (Sentry), shared by the server, edge and browser set-ups. Off unless a DSN is set.
 *
 * Personal data stays out: no cookies, headers, IP addresses, request bodies or user details are sent,
 * query strings are dropped (portal and sign-in links carry secrets), and portal/booking/unsubscribe tokens
 * in paths are masked. What's left is the error, the stack and the page it happened on.
 */
import type { ErrorEvent, Event, EventHint } from "@sentry/nextjs";

export const sentryDsn = () => process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN || undefined;

export const sentryEnvironment = () => process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.VERCEL_ENV || process.env.NODE_ENV;

/** /portal/<token>, /book/<token>, /enquire/<token>, /unsubscribe/<token>, /api/unsubscribe/<token> → <token> masked. */
export function maskPath(url: string): string {
  const [path] = url.split(/[?#]/);
  return path.replace(/\/(portal|book|enquire|unsubscribe)\/[^/]+/g, "/$1/[token]");
}

export function scrubEvent(event: ErrorEvent, _hint?: EventHint): ErrorEvent | null {
  delete event.user;
  if (event.request) {
    event.request = { url: event.request.url ? maskPath(event.request.url) : undefined, method: event.request.method };
  }
  if (event.transaction) event.transaction = maskPath(event.transaction);
  if (event.breadcrumbs) {
    for (const b of event.breadcrumbs) {
      if (typeof b.data?.url === "string") b.data.url = maskPath(b.data.url);
      if (typeof b.data?.to === "string") b.data.to = maskPath(b.data.to);
      if (typeof b.data?.from === "string") b.data.from = maskPath(b.data.from);
    }
  }
  return event;
}

/** Span and transaction attributes that can hold a URL (and so a portal or booking token). */
const URL_KEYS = ["url", "http.url", "url.full", "url.path", "http.target", "http.route", "next.route", "next.span_name"];

/** The same scrubbing for performance traces: page names, request URLs and every span's URL attributes. */
export function scrubTransaction<T extends Event>(event: T, _hint?: EventHint): T | null {
  delete event.user;
  if (event.request) event.request = { url: event.request.url ? maskPath(event.request.url) : undefined, method: event.request.method };
  if (event.transaction) event.transaction = maskPath(event.transaction);
  for (const span of event.spans ?? []) {
    if (span.description) span.description = maskPath(span.description);
    const data = span.data as Record<string, unknown> | undefined;
    if (data) for (const k of URL_KEYS) if (typeof data[k] === "string") data[k] = maskPath(data[k] as string);
  }
  const trace = event.contexts?.trace?.data as Record<string, unknown> | undefined;
  if (trace) for (const k of URL_KEYS) if (typeof trace[k] === "string") trace[k] = maskPath(trace[k] as string);
  return event;
}

/** Errors that aren't ours to fix: browser extensions, cancelled navigations, flaky networks. */
export const ignoreErrors = ["ResizeObserver loop", "NEXT_REDIRECT", "NEXT_NOT_FOUND", "AbortError", "Load failed", "Failed to fetch", "NetworkError when attempting to fetch resource"];

/** Collect nothing personal: no user, cookies, headers, bodies, query strings, query data or local variables. */
export const dataCollection = {
  userInfo: false,
  cookies: false,
  httpHeaders: false,
  httpBodies: [],
  urlQueryParams: false,
  databaseQueryData: false,
  queues: false,
  stackFrameVariables: false,
  genAI: { inputs: false, outputs: false },
} as const;
