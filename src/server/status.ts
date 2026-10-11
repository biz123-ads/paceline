import { SUPABASE } from "@/config/services";

/** What this deployment can do, from its environment. Server only. */
export function serviceStatus() {
  const supabaseAdmin = !!(process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY);
  const accounts = !!SUPABASE;
  return {
    accounts,
    /** Needs accounts (credits live there) and a model key. */
    assistant: accounts && supabaseAdmin && !!process.env.ANTHROPIC_API_KEY,
    /** Credit packs through Stripe Checkout, confirmed by the webhook. */
    creditSales:
      accounts && supabaseAdmin && !!process.env.STRIPE_SECRET_KEY && !!process.env.STRIPE_WEBHOOK_SECRET,
  };
}

export type ServiceStatus = ReturnType<typeof serviceStatus>;
