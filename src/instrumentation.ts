/**
 * Server start-up: error monitoring for the Node.js and edge runtimes (Sentry, when SENTRY_DSN is set).
 * Every error Next.js catches while rendering, in a route handler, a server action or the proxy is reported
 * through `onRequestError`; so are our own `console.error` logs of failed emails, syncs and jobs.
 */
import * as Sentry from "@sentry/nextjs";
import { dataCollection, ignoreErrors, scrubEvent, sentryDsn, sentryEnvironment } from "@/lib/monitoring";

export function register() {
  const dsn = sentryDsn();
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: sentryEnvironment(),
    dataCollection: { ...dataCollection, httpBodies: [] },
    tracesSampleRate: 0.05,
    ignoreErrors,
    beforeSend: scrubEvent,
    integrations: process.env.NEXT_RUNTIME === "nodejs" ? [Sentry.captureConsoleIntegration({ levels: ["error"] })] : [],
  });
}

export const onRequestError = Sentry.captureRequestError;
