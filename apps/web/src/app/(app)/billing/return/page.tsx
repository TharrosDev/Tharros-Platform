import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, Clock } from "lucide-react";

import { getCheckoutStatus } from "@/lib/billing/actions";
import { getPlan } from "@/lib/billing/plans";
import { tierSchema } from "@/lib/billing/schemas";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";

export const metadata = { title: "Subscription" };

export default async function CheckoutReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id: sessionId } = await searchParams;
  if (!sessionId) redirect("/billing");

  const result = await getCheckoutStatus(sessionId);

  // An open session means the user bailed before completing — back to Checkout.
  if (!result || result.status === "open") {
    redirect("/billing");
  }

  const planName = result.tier ? getPlan(tierSchema.parse(result.tier)).name : "your plan";
  const complete = result.status === "complete";

  return (
    <>
      <PageHeader
        title={complete ? "You're all set" : "Almost there"}
        description={
          complete
            ? `Your ${planName} subscription is starting with a free trial.`
            : "We're still finalizing your subscription."
        }
      />

      <div className="flex flex-col items-start gap-4">
        {complete ? (
          <CheckCircle2 className="text-success size-10" aria-hidden />
        ) : (
          <Clock className="text-muted-foreground size-10" aria-hidden />
        )}
        <p className="text-muted-foreground type-body max-w-prose">
          {complete
            ? result.trialing
              ? "Your free trial has begun. You won't be charged until it ends. You can manage or cancel anytime from this page."
              : "Your subscription is active. Thanks for choosing Tharros."
            : "This can take a moment. Refresh shortly, or head to your dashboard, and we'll email you a receipt."}
        </p>
        <Link href="/dashboard" className={cn(buttonVariants({ size: "lg" }))}>
          Go to dashboard
        </Link>
      </div>
    </>
  );
}
