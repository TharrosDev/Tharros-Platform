/**
 * Pure helper for account deletion (Day 21). Given the org ids a user owns and
 * a count of owners per org, returns the orgs the user is the SOLE owner of —
 * those must be deleted as part of erasure (no one else can keep them). Orgs
 * with other owners are simply left (the user's membership cascades when their
 * auth row is removed; organizations.created_by is ON DELETE SET NULL).
 *
 * Kept side-effect free so it can be unit-tested without Supabase/Stripe.
 */
export function soleOwnedOrgIds(
  ownedOrgIds: string[],
  ownerCountByOrg: Record<string, number>,
): string[] {
  return ownedOrgIds.filter((orgId) => (ownerCountByOrg[orgId] ?? 0) <= 1);
}
