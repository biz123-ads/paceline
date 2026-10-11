import Stripe from "stripe";
import { z } from "zod";
import { PERIOD_RE } from "@/lib/period";
import { stripeMonthlySnapshots, type StripeSubscriptionLite } from "@/import/stripe-mrr";

/** Enough for any indie business; stops a runaway loop on huge accounts. */
const MAX_SUBSCRIPTIONS = 20_000;

const requestSchema = z.object({
  /** A restricted key with read access to subscriptions (or a secret key). */
  key: z.string().trim().regex(/^(rk|sk)_(test|live)_[A-Za-z0-9]+$/),
  currency: z.string().regex(/^[A-Z]{3}$/),
  /** Last month to import, in the user's time zone. */
  to: z.string().regex(PERIOD_RE),
});

function error(status: number, message: string) {
  return Response.json({ error: message }, { status });
}

/**
 * Reads the account's subscriptions with the user's own key and returns one
 * row per month. The key is used for this request only and never stored.
 */
export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return error(400, "That doesn't look like a Stripe key. It starts with rk_ or sk_.");
  }
  const { key, currency, to } = parsed.data;
  const stripe = new Stripe(key, { maxNetworkRetries: 1, timeout: 20_000 });

  const subscriptions: StripeSubscriptionLite[] = [];
  try {
    for await (const sub of stripe.subscriptions.list({ status: "all", limit: 100 })) {
      subscriptions.push(sub);
      if (subscriptions.length >= MAX_SUBSCRIPTIONS) break;
    }
  } catch (e) {
    if (e instanceof Stripe.errors.StripeAuthenticationError) {
      return error(401, "Stripe did not accept this key. Check that you copied all of it.");
    }
    if (e instanceof Stripe.errors.StripePermissionError) {
      return error(403, "This key can't read subscriptions. Give it Read access to Subscriptions.");
    }
    console.error("Stripe import failed", e);
    return error(502, "Stripe could not be reached. Try again in a minute.");
  }

  const result = stripeMonthlySnapshots(subscriptions, currency, to);
  return Response.json({ ...result, livemode: key.includes("_live_") });
}
