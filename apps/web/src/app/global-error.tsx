"use client"; // Error boundaries must be Client Components.

import { useEffect } from "react";

import { captureError } from "@/lib/observability/sentry";

/**
 * Last-resort boundary: catches errors thrown by the root layout itself. When
 * active it REPLACES the root layout (and its providers/theme), so it must ship
 * its own <html>/<body> and cannot rely on app components, context, or theme
 * tokens being set. Tailwind utility classes still resolve (global stylesheet),
 * so we lean on those with neutral defaults only.
 *
 * Next.js 16 passes `unstable_retry` (not `reset`).
 */
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    captureError(error, { digest: error.digest, boundary: "global" });
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          background: "#f7f8fb",
          color: "#222735",
        }}
      >
        <main style={{ maxWidth: "28rem", padding: "1.5rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0 0 0.5rem" }}>
            Something went wrong
          </h1>
          <p style={{ margin: "0 0 1.5rem", color: "#57534e", lineHeight: 1.5 }}>
            Tharros hit an unexpected error. The team has been notified. Please try again.
          </p>
          <button
            type="button"
            onClick={() => unstable_retry()}
            style={{
              appearance: "none",
              border: "none",
              cursor: "pointer",
              borderRadius: "0.75rem",
              padding: "0.75rem 1.25rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              background: "#315fc8",
              color: "#fff",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
