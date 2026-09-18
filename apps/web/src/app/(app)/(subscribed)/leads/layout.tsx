import { redirect } from "next/navigation";

import { getFeatureAccess } from "@/lib/billing/entitlements";
import { minTierForFeature } from "@/lib/billing/plans";
import { UpgradeGate } from "@/components/billing/upgrade-gate";

export default async function LeadsLayout({ children }: { children: React.ReactNode }) {
  const access = await getFeatureAccess("leads");
  if (!access.entitled) {
    if (access.reason === "no_subscription") redirect("/billing");
    const requiredPlan = minTierForFeature("leads");
    return (
      <UpgradeGate
        feature="Lead Capture"
        requiredPlanName={requiredPlan?.name ?? "Growth"}
        blurb="Capture enquiries with shareable forms and manage them through a simple lead pipeline."
      />
    );
  }
  return <>{children}</>;
}
