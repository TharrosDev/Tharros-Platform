import { redirect } from "next/navigation";

import { getEntitlement } from "@/lib/billing/entitlements";

/**
 * Day 19 — subscription gate for the product pages (Dashboard / AI Assistant /
 * Lead Capture / Automations). Access requires an active or trialing
 * subscription; anything else (no subscription, past_due, canceled, …) is sent
 * to /billing, which lives outside this group and stays reachable so users can
 * subscribe or fix payment. Auth, onboarding, and the shell are handled by the
 * parent (app)/layout; this is a thin pass-through that only enforces billing.
 */
export default async function SubscribedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { allowed } = await getEntitlement();
  if (!allowed) redirect("/billing");

  return <>{children}</>;
}
