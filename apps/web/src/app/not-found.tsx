import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return (
    <main className="app-shell-canvas bg-background text-foreground flex min-h-screen items-center justify-center px-6 py-16">
      <div className="visual-panel-strong max-w-lg rounded-3xl p-10 text-center">
        <p className="type-meta text-primary">404 · Lost route</p>
        <h1 className="mt-3 text-4xl font-bold tracking-[-0.045em]">Page not found</h1>
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
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
