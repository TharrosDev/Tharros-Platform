import Link from "next/link";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TharrosWordmark } from "@/components/brand/logo";

export default function MarketingHome() {
  return (
    <main className="bg-background flex min-h-screen flex-col items-center justify-center gap-8 px-6 text-center">
      <TharrosWordmark />

      <Badge variant="default" className="gap-1.5">
        <span className="bg-primary size-1.5 rounded-full" />
        Local &amp; Canadian
      </Badge>

      <div className="max-w-2xl space-y-4">
        <h1 className="type-h1 text-balance">Your business, running itself.</h1>
        <p className="type-body text-muted-foreground text-balance">
          The AI operating layer for small businesses. Tharros does the busywork
          so you can get back to the work that matters.
        </p>
      </div>

      <Link href="/dashboard" className={cn(buttonVariants({ size: "lg" }))}>
        Open the dashboard
      </Link>
    </main>
  );
}
