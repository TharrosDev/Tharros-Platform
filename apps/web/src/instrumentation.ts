import * as Sentry from "@sentry/nextjs";

/**
 * Server-side observability bootstrap (Next.js 16 instrumentation). `register`
 * runs once per server instance, in both the Node and Edge runtimes — `Sentry`
 * resolves to the correct client per runtime, so a single init covers both.
 *
 * Sentry only initializes when a DSN is configured AND we're in production. With
 * no DSN it's a complete no-op (no network, no cost); in dev we stay quiet so
 * local errors don't burn quota. `onRequestError` forwards uncaught server
 * errors (Server Components, route handlers) to Sentry.
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

export async function register() {
  if (!dsn) return;

  Sentry.init({
    dsn,
    enabled: process.env.NODE_ENV === "production",
    // Performance tracing sampled low — pre-launch traffic is tiny and traces
    // count against quota. Raise once we actually need latency data.
    tracesSampleRate: 0.1,
    // Capture local variables in server stack traces (Node-only; ignored on
    // Edge). Negligible cost, much richer debugging.
    includeLocalVariables: true,
  });
}

export const onRequestError = Sentry.captureRequestError;
