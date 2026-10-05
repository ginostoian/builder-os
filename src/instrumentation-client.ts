/**
 * Browser start-up: error monitoring (Sentry, when NEXT_PUBLIC_SENTRY_DSN is set). Errors only, no session
 * replay, no cookies; see src/lib/monitoring.ts for what's scrubbed.
 */
import * as Sentry from "@sentry/nextjs";
import { dataCollection, ignoreErrors, scrubEvent, scrubTransaction, sentryEnvironment } from "@/lib/monitoring";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    environment: sentryEnvironment(),
    dataCollection: { ...dataCollection, httpBodies: [] },
    tracesSampleRate: 0.02,
    ignoreErrors,
    beforeSend: scrubEvent,
    beforeSendTransaction: scrubTransaction,
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
