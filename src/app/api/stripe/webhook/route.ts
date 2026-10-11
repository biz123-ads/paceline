import type Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase/server";
import { platformStripe } from "@/server/stripe";

/**
 * Stripe tells us a credit pack was paid. The signature proves it came from
 * Stripe; (reason, reference) in the ledger makes retries harmless, since
 * Stripe may deliver the same event more than once.
 */
export async function POST(request: Request) {
  const stripe = platformStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const admin = supabaseAdmin();
  if (!stripe || !secret || !admin) return new Response("Not configured", { status: 503 });

  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });

  let event: Stripe.Event;
  try {
    // The raw body, exactly as sent: the signature covers its bytes.
    event = await stripe.webhooks.constructEventAsync(await request.text(), signature, secret);
  } catch {
    return new Response("Bad signature", { status: 400 });
  }

  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    const session = event.data.object;
    const userId = session.metadata?.user_id;
    const credits = Number(session.metadata?.credits);
    if (session.payment_status === "paid" && userId && Number.isInteger(credits) && credits > 0) {
      const { error } = await admin
        .from("credit_ledger")
        .upsert(
          { user_id: userId, delta: credits, reason: "purchase", reference: session.id },
          { onConflict: "reason,reference", ignoreDuplicates: true },
        );
      // A 500 makes Stripe retry later.
      if (error) {
        console.error("credit purchase not recorded", session.id, error.message);
        return new Response("Could not record", { status: 500 });
      }
    }
  }
  return new Response("ok");
}
