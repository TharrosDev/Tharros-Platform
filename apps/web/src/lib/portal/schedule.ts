import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/observability/logger";
import {
  resolveSickCallReasonPolicy,
  type SickCallReasonPolicy,
} from "@/lib/scheduling/sick-call";

/**
 * Day 53 — the employee's hosted portal schedule (next 2 weeks of published
 * shifts). The portal is account-less: the caller resolves the employee + org
 * from the validated cookie session (`getPortalSession`) and passes them here.
 * Reads via the service-role admin client scoped strictly to that session
 * (mirrors the Day-45 availability-save pattern) — anon RLS does not apply.
 */

export type PortalShift = {
  id: string;
  startsAt: string;
  endsAt: string;
  breakMinutes: number;
  roleName: string | null;
  notes: string | null;
};

const WINDOW_DAYS = 14;

export async function getPortalSchedule(
  employeeId: string,
  orgId: string,
): Promise<PortalShift[]> {
  const admin = createAdminClient();
  const now = new Date();
  const until = new Date(now.getTime() + WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const { data, error } = await admin
    .from("shifts")
    .select("id, starts_at, ends_at, break_minutes, notes, roles_certifications(name)")
    .eq("employee_id", employeeId)
    .eq("org_id", orgId)
    .eq("status", "published")
    .gte("starts_at", now.toISOString())
    .lt("starts_at", until.toISOString())
    .order("starts_at", { ascending: true });

  if (error) {
    logger.error("getPortalSchedule: query failed", { err: error, employeeId });
    return [];
  }

  return (
    (data ?? []) as unknown as Array<{
      id: string;
      starts_at: string;
      ends_at: string;
      break_minutes: number | null;
      notes: string | null;
      roles_certifications: { name: string } | { name: string }[] | null;
    }>
  ).map((r) => {
    const rc = Array.isArray(r.roles_certifications)
      ? r.roles_certifications[0]
      : r.roles_certifications;
    return {
      id: r.id,
      startsAt: r.starts_at,
      endsAt: r.ends_at,
      breakMinutes: Number(r.break_minutes ?? 0),
      roleName: rc?.name ?? null,
      notes: r.notes ?? null,
    };
  });
}

/** The org's sick-call reason policy (Day 54), read from org_settings.agent_persona. */
export async function getSickCallReasonPolicy(orgId: string): Promise<SickCallReasonPolicy> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("org_settings")
    .select("agent_persona")
    .eq("org_id", orgId)
    .maybeSingle();
  return resolveSickCallReasonPolicy((data as { agent_persona?: unknown } | null)?.agent_persona);
}
