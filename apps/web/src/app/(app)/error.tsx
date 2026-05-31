"use client"; // Error boundaries must be Client Components.

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
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
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <div className="bg-primary-soft text-primary flex size-12 items-center justify-center rounded-full">
        <TriangleAlert className="size-6" />
      </div>
      <h1 className="type-h1 mt-5">Something went wrong</h1>
      <p className="text-muted-foreground mt-2 max-w-md text-balance">
        We hit a snag loading this page. The team has been notified. You can try
        again, and if it keeps happening, reach out and we&apos;ll sort it out.
      </p>
      {error.digest ? (
        <p className="text-muted-foreground mt-3 font-mono text-xs">
          Reference: {error.digest}
        </p>
      ) : null}
      <div className="mt-6">
        <Button onClick={() => unstable_retry()}>Try again</Button>
      </div>
    </div>
  );
}
