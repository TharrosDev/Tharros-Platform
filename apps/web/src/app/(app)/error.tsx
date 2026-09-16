"use client"; // Error boundaries must be Client Components.

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { captureError } from "@/lib/observability/sentry";

/**
 * Segment error boundary for the authed app. Catches uncaught render errors in
 * any (app) route and shows a calm, branded fallback instead of a crash — with a
 * retry that re-renders the segment. Reports the error to Sentry on mount.
 *
 * Next.js 16 passes `unstable_retry` (not `reset`).
 */
export default function AppError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    captureError(error, { digest: error.digest, boundary: "(app)" });
  }, [error]);

  return (
    <EmptyState
      icon={<TriangleAlert />}
      title="Something went wrong"
      description={
        <>
          We hit a snag loading this page. The team has been notified. Try again, and if it keeps
          happening, reach out and we&apos;ll sort it out.
          {error.digest ? (
            <span className="mt-3 block font-mono text-xs">Reference: {error.digest}</span>
          ) : null}
        </>
      }
      action={<Button onClick={() => unstable_retry()}>Try again</Button>}
      tone="danger"
      headingLevel="h1"
      className="min-h-[60vh]"
    />
  );
}
