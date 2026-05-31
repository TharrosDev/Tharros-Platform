import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";

/**
 * Handles the link in Supabase confirmation + password-recovery emails (PKCE
 * `token_hash` flow). The email templates point here:
 *   /auth/confirm?token_hash=...&type=email&next=/dashboard      (signup)
 *   /auth/confirm?token_hash=...&type=recovery&next=/reset-password
 *
 * On success the session cookies are set and we redirect to `next`. On failure
 * we send the user to /login with an error flag. `next` is validated to be a
 * same-origin relative path so the link can't be used as an open redirect.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const nextParam = searchParams.get("next") ?? "/dashboard";
  const next = nextParam.startsWith("/") ? nextParam : "/dashboard";

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }
  }

  return NextResponse.redirect(new URL("/login?error=link_invalid", origin));
}
