/**
 * Clerk → database sync (plan §3). Svix signs every delivery with CLERK_WEBHOOK_SIGNING_SECRET; anything
 * unsigned, mis-signed or older than five minutes is rejected before it is parsed.
 *
 * 2xx tells Svix the event is done. 500 makes it retry with backoff, which is what we want when the
 * database is briefly unavailable.
 */
import type { NextRequest } from "next/server";
import { handleClerkEvent } from "@/auth/clerk-webhook";
import { verifyClerkWebhook } from "@/auth/verify-webhook";

export async function POST(request: NextRequest): Promise<Response> {
  let event;
  try {
    event = await verifyClerkWebhook(request);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }
  try {
    const result = await handleClerkEvent(event);
    return Response.json({ result });
  } catch (error) {
    // Log the event type only: payloads contain names and email addresses.
    console.error("Clerk webhook failed", { type: event.type, error: error instanceof Error ? error.message : "unknown" });
    return new Response("Sync failed", { status: 500 });
  }
}
