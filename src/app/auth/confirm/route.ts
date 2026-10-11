import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseForRequest } from "@/lib/supabase/server";

/** Only paths on this site, so the link can't bounce people elsewhere. */
function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/projects";
}

/**
 * Where the sign-in email lands. Handles both link styles Supabase can send:
 * `token_hash` (works in any browser) and `code` (PKCE, same browser only).
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = safeNext(url.searchParams.get("next"));
  const supabase = await supabaseForRequest();
  const fail = (reason: string) => NextResponse.redirect(new URL(`/login?error=${reason}`, url));
  if (!supabase) return fail("disabled");

  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const code = url.searchParams.get("code");

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) return fail("expired");
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return fail("browser");
  } else {
    return fail("expired");
  }
  return NextResponse.redirect(new URL(next, url));
}
