import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

/**
 * Security headers on every response. Pages can't be framed by other sites (clickjacking), except the
 * web enquiry form, which companies embed on their own websites. Browsers get HTTPS only, no MIME
 * sniffing, a minimal referrer, and no camera, microphone or payment APIs; location stays available to
 * our own pages (the site app's check-in).
 */
const common = [
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self), payment=(), usb=(), interest-cohort=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
];
const csp = (frameAncestors: string) => `base-uri 'self'; object-src 'none'; frame-ancestors ${frameAncestors}; upgrade-insecure-requests`;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // Uploads go through Server Actions: library CSVs (1 MB), photos (shrunk to under 2 MB) and project files
    // (4 MB, src/core/files.ts). Vercel caps a request at 4.5 MB whatever this says.
    serverActions: { bodySizeLimit: "5mb" },
  },
  async headers() {
    return [
      { source: "/((?!enquire/).*)", headers: [...common, { key: "X-Frame-Options", value: "DENY" }, { key: "Content-Security-Policy", value: csp("'none'") }] },
      { source: "/enquire/:path*", headers: [...common, { key: "Content-Security-Policy", value: csp("https:") }] },
    ];
  },
};

/**
 * Error monitoring (Sentry). Without SENTRY_DSN / NEXT_PUBLIC_SENTRY_DSN nothing is sent. With
 * SENTRY_AUTH_TOKEN, SENTRY_ORG and SENTRY_PROJECT, builds upload source maps so stack traces read as our
 * code. Browser reports go through our own /monitoring route, so ad blockers don't drop them.
 */
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  telemetry: false,
  tunnelRoute: "/monitoring",
  widenClientFileUpload: true,
});
