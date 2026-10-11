import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE } from "@/config/services";

let client: SupabaseClient | undefined;

/** The browser's Supabase client, or null when accounts are not set up. */
export function getSupabase(): SupabaseClient | null {
  if (!SUPABASE || typeof window === "undefined") return null;
  // Session in cookies, so route handlers on the server see the same user.
  client ??= createBrowserClient(SUPABASE.url, SUPABASE.key);
  return client;
}
