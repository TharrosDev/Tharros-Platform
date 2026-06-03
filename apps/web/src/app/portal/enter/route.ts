import { NextResponse, type NextRequest } from "next/server";

import {
  PORTAL_COOKIE,
  portalCookieOptions,
  validatePortalToken,
} from "@/lib/portal/session";

/**
 * Day 37 — the employee portal magic-link landing.
 *
 * A Route Handler (not a page) because a cookie can only be SET from a handler,
 * Server Action, or proxy. It validates the `?token=`, and on success stores the
 * token in the httpOnly portal cookie + redirects to a clean `/portal` URL — so
 * the raw credential never lingers in the address bar or browser history. An
 * invalid/expired token just lands on `/portal`, which renders the "ask your
 * manager to resend" state.
 *
 * `/portal` is in PUBLIC_PATHS so the proxy lets this run instead of bouncing the
 * (account-less) employee to /login.
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const session = await validatePortalToken(token);

  const res = NextResponse.redirect(new URL("/portal", req.url));
  if (session) {
    res.cookies.set(PORTAL_COOKIE, token, portalCookieOptions());
  }
  return res;
}
