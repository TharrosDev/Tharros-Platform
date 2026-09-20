import { FeatureGate } from "@/components/billing/feature-gate";

export default function AutomationsLayout({ children }: { children: React.ReactNode }) {
  return <FeatureGate feature="automations">{children}</FeatureGate>;
}
