import type { Metadata } from "next";

import { getOrgContext } from "@/lib/org/queries";
import { OnboardingForm } from "@/components/org/onboarding-form";

export const metadata: Metadata = { title: "Set up your business" };

export default async function OnboardingPage() {
  const { activeOrg } = await getOrgContext();
  // The layout already gated on needsOnboarding, so activeOrg is present here.
  if (!activeOrg) return null;

  return <OnboardingForm orgId={activeOrg.id} />;
}
