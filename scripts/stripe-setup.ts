/**
 * One-off Stripe setup for our subscriptions: the Essentials and Pro products, their monthly GBP prices
 * (found by lookup key, so the app needs no price ids), and a billing portal configuration that lets a
 * company switch between them, update its card, see invoices and cancel at the end of the month.
 *
 * Safe to run again: existing prices (by lookup key) are kept.
 *
 *   STRIPE_SECRET_KEY=sk_test_... pnpm stripe:setup
 */
import Stripe from "stripe";
import { PLAN_LABEL, PLAN_LOOKUP_KEY, PLAN_PRICE_PENCE } from "../src/core/plans";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("Set STRIPE_SECRET_KEY first (test key for previews, live key for production).");
  process.exit(1);
}
const stripe = new Stripe(key);

async function main() {
  const prices: { product: string; price: string }[] = [];
  for (const plan of ["essentials", "pro"] as const) {
    const lookup = PLAN_LOOKUP_KEY[plan];
    const existing = (await stripe.prices.list({ lookup_keys: [lookup], active: true, limit: 1 })).data[0];
    if (existing) {
      console.log(`${PLAN_LABEL[plan]}: already set up (${existing.id}).`);
      prices.push({ product: typeof existing.product === "string" ? existing.product : existing.product.id, price: existing.id });
      continue;
    }
    const product = await stripe.products.create({ name: `Builder OS ${PLAN_LABEL[plan]}`, tax_code: "txcd_10103001", metadata: { plan } });
    const price = await stripe.prices.create({
      product: product.id,
      currency: "gbp",
      unit_amount: PLAN_PRICE_PENCE[plan],
      recurring: { interval: "month" },
      tax_behavior: "exclusive",
      lookup_key: lookup,
      transfer_lookup_key: true,
      nickname: `${PLAN_LABEL[plan]} monthly`,
    });
    console.log(`${PLAN_LABEL[plan]}: created ${price.id}.`);
    prices.push({ product: product.id, price: price.id });
  }
  const portal = await stripe.billingPortal.configurations.create({
    business_profile: { headline: "Builder OS: manage your plan" },
    features: {
      customer_update: { enabled: true, allowed_updates: ["name", "email", "address", "tax_id"] },
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_cancel: { enabled: true, mode: "at_period_end", cancellation_reason: { enabled: true, options: ["too_expensive", "missing_features", "switched_service", "unused", "other"] } },
      subscription_update: { enabled: true, default_allowed_updates: ["price"], proration_behavior: "create_prorations", products: prices.map((p) => ({ product: p.product, prices: [p.price] })) },
    },
  });
  console.log(`\nBilling portal configuration: ${portal.id}`);
  console.log("Set STRIPE_PORTAL_CONFIGURATION to it in Vercel (or leave it unset to use your default portal settings).");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
