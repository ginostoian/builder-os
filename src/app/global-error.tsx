"use client";

import * as React from "react";
import * as Sentry from "@sentry/nextjs";

/** Last resort when the root layout itself fails: report it and offer a way back. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  React.useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  return (
    <html lang="en-GB">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", margin: 0, background: "#FAFAF9", color: "#111110" }}>
        <div style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 20, margin: "0 0 8px" }}>Something went wrong</h1>
          <p style={{ color: "#5c5b57", margin: "0 0 16px" }}>We&apos;ve been told about it. Please try again{error.digest ? ` (reference ${error.digest})` : ""}.</p>
          <button type="button" onClick={reset} style={{ height: 36, padding: "0 16px", borderRadius: 8, border: 0, background: "#111110", color: "#fff", fontWeight: 600, cursor: "pointer" }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
