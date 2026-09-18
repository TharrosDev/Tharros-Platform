import { redirect } from "next/navigation";

import { getFeatureAccess } from "@/lib/billing/entitlements";
import { minTierForFeature } from "@/lib/billing/plans";
import { UpgradeGate } from "@/components/billing/upgrade-gate";

export default async function AutomationsLayout({ children }: { children: React.ReactNode }) {
  const access = await getFeatureAccess("automations");
  if (!access.entitled) {
    if (access.reason === "no_subscription") redirect("/billing");
    const requiredPlan = minTierForFeature("automations");
    return (
      <UpgradeGate
        feature="Automations"
        requiredPlanName={requiredPlan?.name ?? "Pro"}
        blurb="Run native Tharros actions when leads arrive or move through the pipeline."
      />
    );
  }
  return <>{children}</>;
}
