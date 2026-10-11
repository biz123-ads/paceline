import { z } from "zod";
import { CREDIT_PACKS } from "@/config/credits";
import { currentUser } from "@/lib/supabase/server";
import { serviceStatus } from "@/server/status";
import { platformStripe } from "@/server/stripe";

const requestSchema = z.object({ pack: z.enum(CREDIT_PACKS.map((p) => p.id)) });

/** Starts a Stripe Checkout for a credit pack; credits land via the webhook. */
export async function POST(request: Request) {
  if (!serviceStatus().creditSales) {
    return Response.json({ error: "Credits are not on sale on this server." }, { status: 503 });
  }
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sign in to buy credits." }, { status: 401 });
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Unknown pack." }, { status: 400 });

  const pack = CREDIT_PACKS.find((p) => p.id === parsed.data.pack)!;
  const origin = new URL(request.url).origin;
  const session = await platformStripe()!.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: pack.currency,
          unit_amount: pack.price,
          product_data: { name: `${pack.credits} assistant credits` },
        },
      },
    ],
    client_reference_id: user.id,
    customer_email: user.email,
    // Read back by the webhook; never trusted from the browser.
    metadata: { user_id: user.id, credits: String(pack.credits), pack: pack.id },
    success_url: `${origin}/settings?credits=success`,
    cancel_url: `${origin}/settings?credits=cancelled`,
  });
  return Response.json({ url: session.url });
}
