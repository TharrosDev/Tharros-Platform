import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { getPlan, formatMonthly } from "@/lib/billing/plans";
import { tierSchema } from "@/lib/billing/schemas";
import { getOrgContext } from "@/lib/org/queries";
import { PageHeader } from "@/components/page-header";
import { CheckoutForm } from "@/components/billing/embedded-checkout";

export const metadata = { title: "Subscribe" };

export default async function SubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const { plan: planParam } = await searchParams;
  const parsed = tierSchema.safeParse(planParam);
  if (!parsed.success) notFound();
  const plan = getPlan(parsed.data);

  // Billing is owner-only — send non-owners back to the plan list.
  const { activeOrg } = await getOrgContext();
  if (activeOrg?.role !== "owner") redirect("/billing");

  return (
    <>
      <PageHeader
        title={`Subscribe to ${plan.name}`}
        description={`${formatMonthly(plan.priceMonthly)}/month after your free trial.`}
      />

      <Link
        href="/billing"
        className="text-muted-foreground hover:text-foreground type-small inline-flex items-center gap-1.5"
      >
        <ArrowLeft className="size-4" />
        Back to plans
      </Link>

      <CheckoutForm tier={plan.tier} />
    </>
  );
}
