import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api/webhooks (Stripe et al. — no Supabase session; must not be bounced
     *   to /login or have session-refresh run on a third-party POST)
     * - monitoring (Sentry tunnelRoute — must not run through session refresh)
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, sitemap.xml, robots.txt
     * - image files
     * Feel free to refine once auth-gated routes exist.
     */
    "/((?!api/webhooks|monitoring|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
