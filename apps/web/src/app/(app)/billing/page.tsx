import { getSubscription } from "@/lib/billing/entitlements";
import { getRecentInvoices } from "@/lib/billing/queries";
import { getOrgContext } from "@/lib/org/queries";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { PlanPicker } from "@/components/billing/plan-picker";
import { BillingOverview } from "@/components/billing/billing-overview";

export const metadata = { title: "Billing" };

// Statuses where the org has a manageable subscription → show the overview.
// Anything else (no row, canceled, incomplete*) → show the plan picker.
const MANAGEABLE = new Set([
  "active",
  "trialing",
  "past_due",
  "unpaid",
  "paused",
]);

export default async function BillingPage() {
  const [{ activeOrg }, subscription] = await Promise.all([
    getOrgContext(),
    getSubscription(),
  ]);
  const isOwner = activeOrg?.role === "owner";
  const subscribed = subscription !== null && MANAGEABLE.has(subscription.status);

  if (subscribed && activeOrg) {
    // Resolve the org's Stripe customer to pull recent invoices.
    const supabase = await createClient();
    const { data: org } = await supabase
      .from("organizations")
      .select("stripe_customer_id")
      .eq("id", activeOrg.id)
      .single();
    const customerId = org?.stripe_customer_id as string | null | undefined;
    const invoices = customerId ? await getRecentInvoices(customerId) : [];

    return (
      <>
        <PageHeader
          title="Billing"
          description="Your plan, payment method, and invoices."
        />
        <BillingOverview
          subscription={subscription}
          invoices={invoices}
          isOwner={isOwner}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Choose your plan"
        description="Pick the plan that fits how you work today. You can move up or down anytime."
      />
      {!isOwner && (
        <p className="text-muted-foreground type-small">
          Only the organization owner can manage billing.
        </p>
      )}
      <PlanPicker isOwner={isOwner} />
    </>
  );
}
