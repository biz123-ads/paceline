import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { SUPABASE } from "@/config/services";

/**
 * Server-side Supabase clients, for route handlers only.
 * - `supabaseForRequest`: acts as the signed-in user (cookies), RLS applies.
 * - `supabaseAdmin`: the service role, for the credit ledger. Never shipped
 *   to the browser: SUPABASE_SECRET_KEY has no NEXT_PUBLIC_ prefix.
 */

export async function supabaseForRequest(): Promise<SupabaseClient | null> {
  if (!SUPABASE) return null;
  const store = await cookies();
  return createServerClient(SUPABASE.url, SUPABASE.key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        for (const { name, value, options } of list) store.set(name, value, options);
      },
    },
  });
}

/** The user behind this request, checked with Supabase Auth; null if none. */
export async function currentUser(): Promise<User | null> {
  const supabase = await supabaseForRequest();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user;
}

let admin: SupabaseClient | null | undefined;

export function supabaseAdmin(): SupabaseClient | null {
  if (admin !== undefined) return admin;
  const secret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  admin =
    SUPABASE && secret
      ? createClient(SUPABASE.url, secret, { auth: { persistSession: false, autoRefreshToken: false } })
      : null;
  return admin;
}
