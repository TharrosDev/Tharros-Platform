import Link from "next/link";
import { Gauge, OctagonAlert } from "lucide-react";

import { cn } from "@/lib/utils";
import type { UsageBannerState } from "@/lib/billing/usage-math";
import { buttonVariants } from "@/components/ui/button";

/**
 * Day 61 — app-wide AI-usage banner. Renders nothing unless the org is near
 * (≥80%) or at its monthly AI cap. "warning" nudges an upgrade; "reached" tells
 * the user AI features are paused until reset. Driven by the pure
 * `usageBannerState`, so this stays a thin presenter.
 */
export function UsageBanner({ state }: { state: UsageBannerState }) {
  if (!state) return null;

  const reached = state.tone === "reached";
  const Icon = reached ? OctagonAlert : Gauge;
  const message = reached
    ? `You've used all ${state.cap.toLocaleString()} AI actions in your plan this month. AI features pause until your limit resets at the start of next month.`
    : `You've used ${state.used.toLocaleString()} of ${state.cap.toLocaleString()} AI actions this month.`;

  return (
    <div
      role="status"
      className={cn(
        "flex flex-col gap-2 border-b px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-6",
        reached
          ? "border-destructive/20 bg-destructive/10 text-destructive"
          : "border-warning/20 bg-warning/10 text-warning",
      )}
    >
      <div className="flex items-center gap-2">
        <Icon className="size-4 shrink-0" aria-hidden />
        <span className="type-small font-medium">{message}</span>
      </div>
      <Link
        href="/billing"
        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-fit shrink-0 bg-background/60")}
      >
        Upgrade plan
      </Link>
    </div>
  );
}
