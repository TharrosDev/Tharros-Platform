import * as Sentry from "@sentry/nextjs";

/**
 * Browser-side observability bootstrap (Next.js 16 client instrumentation). Runs
 * after the document loads, before React hydration — early enough to catch
 * startup errors.
 *
 * Same gating as the server side: only initializes with a DSN AND in production,
 * so it's a no-op (no cost) otherwise. `onRouterTransitionStart` lets Sentry
 * track App Router client navigations as part of tracing.
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    enabled: process.env.NODE_ENV === "production",
    tracesSampleRate: 0.1,
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
