import { ACTIVE_STATUSES, type SubscriptionStatus, type Tier } from "@/lib/billing/schemas";

export type AutomationSubscription = {
  status?: SubscriptionStatus | null;
  tier?: Tier | null;
} | null;

/**
 * Durable workers have no user session, so automation entitlement must be
 * rechecked against the organization subscription at execution time.
 */
export function canExecuteAutomations(subscription: AutomationSubscription): boolean {
  return (
    subscription?.status !== undefined &&
    subscription.status !== null &&
    ACTIVE_STATUSES.includes(subscription.status) &&
    subscription.tier === "pro"
  );
}
