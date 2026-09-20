"use client";

import Link from "next/link";
import { TriangleAlert } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";

/**
 * Public pages used to fall through to the global boundary, which renders
 * unbranded inline-styled markup outside the CSS bundle. This keeps a failed
 * public page inside the rack.
 */
export default function MarketingError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-start justify-center gap-4 px-4 sm:px-8">
      <TriangleAlert className="text-primary size-6" aria-hidden />
      <h1 className="type-display">This page did not load.</h1>
      <p className="text-rack-muted-foreground type-body">
        Something failed on our side. Nothing you did caused it, and nothing was lost.
      </p>
      <div className="flex flex-wrap gap-2 pt-2">
        <button type="button" onClick={reset} className={buttonVariants()}>
          Try again
        </button>
        <Link href="/" className={buttonVariants({ variant: "outline" })}>
          Back to home
        </Link>
      </div>
    </div>
  );
}
