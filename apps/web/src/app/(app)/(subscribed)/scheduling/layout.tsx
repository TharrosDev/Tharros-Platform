import { redirect } from "next/navigation";

import { getFeatureAccess } from "@/lib/billing/entitlements";
import { minTierForFeature } from "@/lib/billing/plans";
import { UpgradeGate } from "@/components/billing/upgrade-gate";

/**
 * Day 61 — feature gate for AI Workforce Scheduling. The parent (subscribed)
 * group already requires an active subscription; this adds the per-tier check:
 * scheduling is a team feature (Growth+), so a Starter org sees an upgrade prompt
 * instead of the product (`reason='not_in_plan'`). A missing subscription
 * (shouldn't reach here) falls back to /billing.
 */
export default async function SchedulingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await getFeatureAccess("scheduling");

  if (access.entitled) return <>{children}</>;
  if (access.reason === "no_subscription") redirect("/billing");

  const requiredPlan = minTierForFeature("scheduling");
  return (
    <UpgradeGate
      feature="Scheduling"
      requiredPlanName={requiredPlan?.name ?? "Growth"}
      blurb="Build conflict-free staff schedules with the AI workforce scheduler — availability collection, auto-generation, and disruption handling."
    />
  );
}
