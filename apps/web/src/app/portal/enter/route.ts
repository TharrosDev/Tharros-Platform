import { NextResponse, type NextRequest } from "next/server";

import {
  PORTAL_COOKIE,
  portalCookieOptions,
  validatePortalToken,
} from "@/lib/portal/session";
import { sanitizeNext } from "@/lib/auth/safe-redirect";

/**
 * Day 37 — the employee portal magic-link landing.
 *
 * A Route Handler (not a page) because a cookie can only be SET from a handler,
 * Server Action, or proxy. It validates the `?token=`, and on success stores the
 * token in the httpOnly portal cookie + redirects to a clean URL — so the raw
 * credential never lingers in the address bar or browser history. An
 * invalid/expired token just lands on `/portal`, which renders the "ask your
 * manager to resend" state.
 *
 * An optional `?next=` deep-links to a specific portal page after sign-in (e.g.
 * the availability email points at `/portal/availability`). It's allow-listed to
 * `/portal...` paths so it can't be turned into an open redirect.
 *
 * `/portal` is in PUBLIC_PATHS so the proxy lets this run instead of bouncing the
 * (account-less) employee to /login.
 */
export const dynamic = "force-dynamic";

/** Only allow same-app portal destinations — never an off-site open redirect. */
function safeNext(next: string | null): string {
  const safe = sanitizeNext(next ?? "");
  if (safe === "/portal" || safe?.startsWith("/portal/") || safe?.startsWith("/portal?")) {
    return safe;
  }
  return "/portal";
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const session = await validatePortalToken(token);

  const dest = session ? safeNext(req.nextUrl.searchParams.get("next")) : "/portal";
  const res = NextResponse.redirect(new URL(dest, req.url));
  if (session) {
    res.cookies.set(PORTAL_COOKIE, token, portalCookieOptions());
  }
  return res;
}
