import type Stripe from "stripe";
import { handleStripeEvent } from "@/server/stripe-events";
import { stripe, stripeConfigured } from "@/server/stripe";

export const dynamic = "force-dynamic";

/**
 * Stripe webhooks: our subscriptions (STRIPE_WEBHOOK_SECRET) and events on companies' own accounts
 * (Connect, STRIPE_CONNECT_WEBHOOK_SECRET). Unsigned or wrongly signed requests are refused. A failure
 * answers 500 so Stripe retries; handling is idempotent.
 */
export async function POST(request: Request) {
  if (!stripeConfigured()) return Response.json({ error: "Stripe isn't set up." }, { status: 503 });
  const signature = request.headers.get("stripe-signature");
  const body = await request.text();
  const secrets = [process.env.STRIPE_WEBHOOK_SECRET, process.env.STRIPE_CONNECT_WEBHOOK_SECRET].filter((s): s is string => Boolean(s?.trim()));
  let event: Stripe.Event | null = null;
  for (const secret of secrets) {
    try {
      event = stripe().webhooks.constructEvent(body, signature ?? "", secret.trim());
      break;
    } catch {
      // Try the other endpoint's secret.
    }
  }
  if (!event) return Response.json({ error: "Bad signature" }, { status: 400 });
  try {
    const outcome = await handleStripeEvent(event);
    return Response.json({ received: true, outcome });
  } catch (error) {
    console.error("Stripe webhook failed", event.type, error instanceof Error ? error.message : error);
    return Response.json({ error: "Failed" }, { status: 500 });
  }
}
