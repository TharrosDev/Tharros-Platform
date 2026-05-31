import { CreditCard } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { ComingSoon } from "@/components/shell/coming-soon";

export default function BillingPage() {
  return (
    <>
      <PageHeader
        title="Billing"
        description="Your plan, payment method, and invoices."
      />
      <ComingSoon
        icon={CreditCard}
        message="Subscription and billing details will live here once Stripe goes live. Landing in a later phase."
      />
    </>
  );
}
