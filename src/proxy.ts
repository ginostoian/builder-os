/**
 * Next.js proxy (formerly middleware). Clerk runs only on the app, auth and API routes: the marketing site
 * and the client quote links stay static and never load Clerk.
 */
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isSignedInOnly = createRouteMatcher(["/app(.*)", "/m(.*)", "/admin(.*)"]);

export default clerkMiddleware(
  async (auth, request) => {
    if (isSignedInOnly(request)) await auth.protect();
  },
  // Our own pages, not Clerk's hosted Account Portal. Must match AuthProvider.
  { signInUrl: "/sign-in", signUpUrl: "/sign-up" },
);

export const config = {
  matcher: ["/app/:path*", "/m/:path*", "/admin/:path*", "/admin", "/sign-in/:path*", "/sign-up/:path*", "/select-company/:path*", "/api/:path*"],
};
