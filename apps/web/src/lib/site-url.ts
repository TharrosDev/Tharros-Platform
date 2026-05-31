/**
 * Absolute base URL for the app, used to build email-redirect links (Supabase
 * rejects relative URLs in confirmation / recovery emails).
 *
 * Resolution order:
 *   1. NEXT_PUBLIC_SITE_URL — set explicitly per environment (prod = https://tharros.ca)
 *   2. VERCEL_URL — auto-set on Vercel deploys (host only, no protocol)
 *   3. http://localhost:3000 — local dev fallback
 *
 * Always returns an origin with a protocol and no trailing slash.
 */
export function getURL(): string {
  let url =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ??
    "http://localhost:3000";

  if (!url.startsWith("http")) url = `https://${url}`;
  return url.replace(/\/+$/, "");
}
