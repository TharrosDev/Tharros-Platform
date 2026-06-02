import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { env } from "@/env";

/**
 * Public path prefixes that never require an authenticated session. Everything
 * else is treated as protected and bounced to /login when signed out.
 */
const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/pricing", // public marketing pricing — reachable signed-out
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/auth", // /auth/confirm callback
  "/invite", // team-invite accept (redeems server-side; bounces to login itself)
  "/monitoring", // Sentry tunnel (also excluded by the proxy matcher)
  "/api/webhooks", // Stripe webhook (also excluded by the proxy matcher)
];

function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true; // marketing home
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/**
 * Refreshes the Supabase auth session on every request, keeps the auth cookies
 * in sync between request and response, and optimistically redirects signed-out
 * users away from protected routes. Called from `proxy.ts` (the Next.js 16
 * successor to middleware).
 *
 * This redirect is UX-only — the authoritative gate is `getUser()` in the
 * `(app)` layout. Do not add logic between `createServerClient` and
 * `supabase.auth.getUser()`; it can cause hard-to-debug session refresh issues.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: keep getUser() immediately after createServerClient.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Signed out and heading somewhere protected → send to /login.
  if (!user && !isPublicPath(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
