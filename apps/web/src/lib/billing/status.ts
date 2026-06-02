import type { SubscriptionStatus } from "@/lib/billing/schemas";

/**
 * Day 20 — presentation helpers for a subscription status. Pure (unit-tested);
 * the badge variants are the ones defined in components/ui/badge.tsx.
 */

const LABELS: Record<SubscriptionStatus, string> = {
  trialing: "Trial",
  active: "Active",
  past_due: "Past due",
  canceled: "Canceled",
  incomplete: "Incomplete",
  incomplete_expired: "Expired",
  unpaid: "Unpaid",
  paused: "Paused",
};

export type BadgeVariant = "success" | "info" | "destructive" | "secondary";

const VARIANTS: Record<SubscriptionStatus, BadgeVariant> = {
  active: "success",
  trialing: "info",
  past_due: "destructive",
  unpaid: "destructive",
  canceled: "secondary",
  incomplete: "secondary",
  incomplete_expired: "secondary",
  paused: "secondary",
};

export function statusLabel(status: SubscriptionStatus): string {
  return LABELS[status];
}

export function statusBadgeVariant(status: SubscriptionStatus): BadgeVariant {
  return VARIANTS[status];
}
