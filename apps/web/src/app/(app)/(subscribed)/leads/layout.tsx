import { FeatureGate } from "@/components/billing/feature-gate";

export default function LeadsLayout({ children }: { children: React.ReactNode }) {
  return <FeatureGate feature="leads">{children}</FeatureGate>;
}
