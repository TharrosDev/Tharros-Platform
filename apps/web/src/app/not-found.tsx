import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return (
    <main className="bg-background text-foreground flex min-h-screen items-center justify-center px-6 py-16">
      <div className="max-w-md text-center">
        <p className="text-primary-soft-foreground num text-sm font-semibold">404</p>
        <h1 className="type-display mt-2">Page not found</h1>
        <p className="text-muted-foreground type-body mt-3">
          The page may have moved, the record may no longer exist, or you may not have access to it.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link href="/dashboard" className={cn(buttonVariants())}>
            Go to dashboard
          </Link>
          <Link href="/" className={cn(buttonVariants({ variant: "outline" }))}>
            Tharros home
          </Link>
        </div>
      </div>
    </main>
  );
}
