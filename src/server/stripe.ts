import Stripe from "stripe";

let client: Stripe | null | undefined;

/** The platform's own Stripe account (selling credits). Server only. */
export function platformStripe(): Stripe | null {
  if (client !== undefined) return client;
  const key = process.env.STRIPE_SECRET_KEY;
  client = key ? new Stripe(key, { maxNetworkRetries: 2 }) : null;
  return client;
}
