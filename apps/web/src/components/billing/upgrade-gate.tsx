import Link from "next/link";
import { Lock } from "lucide-react";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

/**
 * Day 61 — feature-locked gate. Shown in place of a product surface when the org
 * is subscribed but its tier doesn't include the feature (`reason='not_in_plan'`).
 * A friendly upgrade prompt — never a dead-end redirect — naming the lowest tier
 * that unlocks it. Server component (no state).
 */
export function UpgradeGate({
  feature,
  requiredPlanName,
  blurb,
}: {
  /** Display name of the locked feature, e.g. "Scheduling". */
  feature: string;
  /** Lowest plan that unlocks it, e.g. "Growth". */
  requiredPlanName: string;
  /** One-line value statement for the feature. */
  blurb: string;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-lg border bg-card px-6 py-16 text-center shadow-xs">
      <span className="bg-primary-soft/40 text-primary flex size-12 items-center justify-center rounded-full">
        <Lock className="size-5" aria-hidden />
      </span>
      <div className="space-y-1.5">
        <h1 className="type-h2 text-lg font-semibold">{feature} is a {requiredPlanName} feature</h1>
        <p className="text-muted-foreground text-sm">{blurb}</p>
      </div>
      <p className="text-muted-foreground text-sm">
        Upgrade to <span className="text-foreground font-medium">{requiredPlanName}</span> to unlock it.
      </p>
      <Link href="/billing" className={cn(buttonVariants(), "mt-1")}>
        Upgrade plan
      </Link>
    </div>
  );
}
