/**
 * Optional services, switched on by environment variables (see .env.example).
 * Without them the app runs as before: data in the browser, no accounts, no
 * assistant. NEXT_PUBLIC_ values are inlined into the browser bundle at
 * build time, so only public keys go here; what the server can do (the
 * assistant, selling credits) is reported by /api/status.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// Supabase's newer "publishable" key, or the legacy anon key.
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Accounts and cloud storage. */
export const SUPABASE: { url: string; key: string } | null =
  supabaseUrl && supabaseKey ? { url: supabaseUrl, key: supabaseKey } : null;
