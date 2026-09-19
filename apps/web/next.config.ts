import path from "node:path";
import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// Validate environment variables at the very start of every build and `dev`
// start. Next loads .env files before reading this config, so a missing or
// malformed required key fails fast here with a named error.
import "./src/env";

const isDev = process.env.NODE_ENV === "development";

function configuredOrigin(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  try {
    return new URL(value).origin;
  } catch {
    return fallback;
  }
}

const supabaseHttpOrigin = configuredOrigin(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  "https://*.supabase.co",
);
const supabaseWsOrigin = supabaseHttpOrigin.replace(/^https:/, "wss:").replace(/^http:/, "ws:");

// Content Security Policy. We deliberately use the static, header-based
// ("Without Nonces") path from the Next.js CSP guide rather than a nonce so
// our public/shell routes can keep prerendering statically — nonces force
// every page to dynamic rendering and are PPR-incompatible. A nonce-based
// strict CSP is deferred to Phase 7 (Security & Hardening), once the app is
// fully dynamic behind auth anyway.
//
// `'unsafe-inline'` in script-src is required because the App Router streams
// the RSC payload via inline bootstrap scripts and we don't issue nonces here.
// Everything else is locked down. connect-src stays small on purpose: Sentry
// events tunnel through same-origin `/monitoring` and Vercel Analytics beacons
// are same-origin, so only Supabase (REST + Realtime websocket) needs listing.
//
// Stripe (Day 17): embedded Checkout loads Stripe.js from js.stripe.com and
// mounts the payment form in iframes from js.stripe.com / checkout.stripe.com
// (3DS challenges come from hooks.stripe.com), and Stripe.js posts to
// api.stripe.com. Hence the stripe origins in script-/frame-/connect-src.
const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://js.stripe.com;
  script-src-attr 'none';
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data:;
  font-src 'self';
  media-src 'self' blob:;
  worker-src 'self' blob:;
  manifest-src 'self';
  connect-src 'self' ${supabaseHttpOrigin} ${supabaseWsOrigin} https://api.stripe.com https://checkout.stripe.com;
  frame-src 'self' https://js.stripe.com https://checkout.stripe.com https://hooks.stripe.com;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  upgrade-insecure-requests;
`
  .replace(/\s{2,}/g, " ")
  .trim();

// Security headers applied to every response. CSP covers clickjacking
// (frame-ancestors) and mixed content (upgrade-insecure-requests); the rest
// are the standard defense-in-depth set. HSTS is safe on *.vercel.app (already
// preloaded) and on any future custom domain served over HTTPS.
const securityHeaders = [
  { key: "Content-Security-Policy", value: cspHeader },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  { key: "Origin-Agent-Cluster", value: "?1" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
];

const nextConfig: NextConfig = {
  // Pin the Turbopack root to the monorepo so Next doesn't misinfer it from a
  // stray lockfile elsewhere on the machine.
  turbopack: {
    root: path.join(__dirname, "..", ".."),
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

// Wrap with Sentry's build plugin. Source-map upload only happens when an auth
// token + org/project are present (set them at launch); without them the build
// stays green and simply skips upload — runtime reporting still works from the
// DSN. `silent` unless on CI keeps local builds quiet.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  // Proxy Sentry events through our own domain so ad-blockers don't drop
  // client-side errors. Excluded from the proxy.ts matcher.
  tunnelRoute: "/monitoring",
});
