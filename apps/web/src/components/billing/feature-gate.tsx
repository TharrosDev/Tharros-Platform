import { redirect } from "next/navigation";

import { getFeatureAccess } from "@/lib/billing/entitlements";
import { minTierForFeature, type ProductFeature } from "@/lib/billing/plans";
import { UpgradeGate } from "@/components/billing/upgrade-gate";

/*
  One entitlement gate for the three paid product sections. Each section used
  to carry its own copy of this preamble, and scheduling carried a third
  variant with extra logic, so a change to the gate meant remembering all
  three.

  The parent (subscribed) group already requires an active subscription; this
  adds the per-tier check. A missing subscription should not reach here, and
  falls back to /billing if it does.
*/
const COPY: Record<ProductFeature, { label: string; fallbackPlan: string; blurb: string }> = {
  assistant: {
    label: "AI Business Assistant",
    fallbackPlan: "Starter",
    blurb: "Ask questions in plain words and get answers grounded in your own documents.",
  },
  scheduling: {
    label: "Scheduling",
    fallbackPlan: "Growth",
    blurb:
      "Collect availability, generate a schedule around real constraints and review it before anything is published.",
  },
  leads: {
    label: "Lead Capture",
    fallbackPlan: "Growth",
    blurb: "Capture enquiries with shareable forms and move them through a simple lead pipeline.",
  },
  automations: {
    label: "Automations",
    fallbackPlan: "Pro",
    blurb: "Run native Tharros actions when leads arrive or move through the pipeline.",
  },
};

/**
 * Renders `children` when the org is entitled to `feature`, and the upgrade
 * prompt when it is not. Route actions still enforce entitlement on their own:
 * this is the visible half, not the authoritative one.
 */
export async function FeatureGate({
  feature,
  children,
}: {
  feature: ProductFeature;
  children: React.ReactNode;
}) {
  const access = await getFeatureAccess(feature);
  if (access.entitled) return <>{children}</>;
  if (access.reason === "no_subscription") redirect("/billing");

  const copy = COPY[feature];
  return (
    <UpgradeGate
      feature={copy.label}
      requiredPlanName={minTierForFeature(feature)?.name ?? copy.fallbackPlan}
      blurb={copy.blurb}
    />
  );
}
