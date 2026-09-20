import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

/**
 * A public 404 that does not tell a stranger to go to a dashboard they cannot
 * reach. The app has its own not-found for signed-in routes.
 */
export default function MarketingNotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-start justify-center gap-4 px-4 sm:px-8">
      <p className="type-meta text-primary">404</p>
      <h1 className="type-display">That page is not on the board.</h1>
      <p className="text-rack-muted-foreground type-body">
        The link may be old, or the page may have moved.
      </p>
      <div className="flex flex-wrap gap-2 pt-2">
        <Link href="/" className={buttonVariants()}>
          Back to home
        </Link>
        <Link href="/pricing" className={buttonVariants({ variant: "outline" })}>
          See plans
        </Link>
      </div>
    </div>
  );
}
