/** Svix signature check for Clerk webhooks (CLERK_WEBHOOK_SIGNING_SECRET). Throws if invalid or stale. */
import "server-only";
import type { NextRequest } from "next/server";
import { verifyWebhook } from "@clerk/nextjs/webhooks";

export const verifyClerkWebhook = (request: NextRequest) => verifyWebhook(request);
