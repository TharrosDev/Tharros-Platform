/**
 * Thin wrapper over the Sentry SDK so the rest of the app never imports
 * `@sentry/nextjs` directly. This keeps two things true:
 *
 *  1. There is exactly one place that knows how we report errors, so swapping or
 *     augmenting the tracker later touches one file.
 *  2. When no DSN is configured the SDK's `init` never runs (see
 *     instrumentation*.ts), so these calls are safe no-ops — Sentry's capture
 *     functions simply do nothing when the client is uninitialized. No network,
 *     no cost.
 *
 * Works in Node, Edge, and browser runtimes — `@sentry/nextjs` re-exports the
 * right client per runtime.
 */
import * as Sentry from "@sentry/nextjs";

type Extra = Record<string, unknown>;

/** Capture a thrown value (ideally an Error) with optional structured context. */
export function captureError(err: unknown, extra?: Extra) {
  Sentry.captureException(err, extra ? { extra } : undefined);
}

/** Capture a message-only event (no exception object available). */
export function captureMessage(message: string, extra?: Extra) {
  Sentry.captureMessage(message, extra ? { level: "error", extra } : undefined);
}
