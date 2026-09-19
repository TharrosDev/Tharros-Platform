"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { checkQueryCap, recordUsage } from "@/lib/billing/usage";
import { requireSchedulingAccess } from "@/lib/scheduling/access";
import { chatCompletion } from "@/lib/deepseek/client";
import { SCHEDULING_MODEL_PRO } from "@/lib/deepseek/models";
import { mapDeepSeekUsage } from "@/lib/deepseek/usage";
import { logger } from "@/lib/observability/logger";

import { staffingDaySchema, type StaffingDay } from "./schemas";
import {
  forecastStaffing,
  resolveStaffingRoles,
  type ForecastContext,
  type ForecastStaffing,
} from "./forecast";

/**
 * Day 47 — manager-side demand forecasting. `runStaffingForecast` assembles the
 * org's business context and asks the DeepSeek forecasting agent for suggested
 * staffing (a PREVIEW — not saved); `saveStaffingForecast` persists a confirmed
 * set as `source='forecast'` rows. All reads/writes go through the user-session
 * client, so the Day-41 owner/admin-write RLS on `staffing_requirements` gates
 * persistence (no RPC/migration). The model call meters into the Day-33
 * `ai_usage_events` like every other AI call.
 */

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export type ForecastState =
  | { ok: true; preview: ForecastStaffing }
  | { ok: false; message: string };

/** Assemble the business context the forecast reasons from. */
async function buildForecastContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
): Promise<ForecastContext> {
  const [hoursRes, employeesRes, rolesRes, baselineRes, settingsRes] = await Promise.all([
    supabase
      .from("business_hours")
      .select("day_of_week, opens_at, closes_at, is_closed")
      .eq("org_id", orgId),
    supabase.from("employees").select("employment_type").eq("org_id", orgId).eq("active", true),
    supabase.from("roles_certifications").select("name").eq("org_id", orgId).eq("kind", "role"),
    supabase
      .from("staffing_requirements")
      .select("day_of_week, start_time, end_time, min_staff, role_certification_id")
      .eq("org_id", orgId)
      .eq("source", "manual"),
    supabase.from("org_settings").select("agent_persona").eq("org_id", orgId).maybeSingle(),
  ]);

  const employees = (employeesRes.data ?? []) as Array<{ employment_type: string }>;
  const employmentMix: Record<string, number> = {};
  for (const e of employees) {
    employmentMix[e.employment_type] = (employmentMix[e.employment_type] ?? 0) + 1;
  }
  const roleNames = ((rolesRes.data ?? []) as Array<{ name: string }>).map((r) => r.name);
  // Baseline rows reference roles by id only; the agent picks from `roster.roles`
  // (the name list), so baseline `role` is reported as null here — names aren't needed.
  const persona = (settingsRes.data?.agent_persona ?? {}) as { tone?: string; notes?: string };

  return {
    businessHours: (hoursRes.data ?? []) as ForecastContext["businessHours"],
    roster: {
      count: employees.length,
      roles: roleNames,
      employmentMix,
    },
    manualBaseline: ((baselineRes.data ?? []) as Array<{
      day_of_week: number | null;
      start_time: string;
      end_time: string;
      min_staff: number;
    }>).map((r) => ({
      day_of_week: r.day_of_week,
      start_time: r.start_time,
      end_time: r.end_time,
      min_staff: r.min_staff,
      role: null,
    })),
    persona: { tone: persona.tone ?? "professional", notes: persona.notes ?? "" },
  };
}

/** Run the forecast and return a preview (not saved). Owner/admin only via RLS. */
export async function runStaffingForecast(): Promise<ForecastState> {
  const access = await requireSchedulingAccess();
  if (!access.ok) return { ok: false, message: access.message };
  const { user, activeOrg } = access;
  if (activeOrg.role !== "owner" && activeOrg.role !== "admin") {
    return { ok: false, message: "Only an owner or admin can run staffing forecasts." };
  }
  const cap = await checkQueryCap(activeOrg.id);
  if (!cap.allowed) {
    return { ok: false, message: "You've reached your plan's monthly AI limit." };
  }

  const supabase = await createClient();
  try {
    const context = await buildForecastContext(supabase, activeOrg.id);
    const preview = await forecastStaffing(
      { context, today: today() },
      {
        chat: chatCompletion,
        model: SCHEDULING_MODEL_PRO,
        onUsage: (model, usage) => recordUsage(activeOrg.id, user.id, model, mapDeepSeekUsage(usage)),
      },
    );
    return { ok: true, preview };
  } catch (err) {
    logger.error("runStaffingForecast: failed", { err, orgId: activeOrg.id });
    return { ok: false, message: "Couldn't generate a forecast just now. Please try again." };
  }
}

export type SaveForecastResult = { ok: boolean; message: string };

/**
 * Persist a confirmed forecast as the org's `source='forecast'` staffing rows
 * (replacing any prior forecast). Manual rows are untouched.
 */
export async function saveStaffingForecast(
  requirements: StaffingDay[],
): Promise<SaveForecastResult> {
  const access = await requireSchedulingAccess();
  if (!access.ok) return { ok: false, message: access.message };
  const { activeOrg } = access;
  if (activeOrg.role !== "owner" && activeOrg.role !== "admin") {
    return { ok: false, message: "Only an owner or admin can save staffing forecasts." };
  }

  const valid = z.array(staffingDaySchema).max(60).safeParse(requirements);
  if (!valid.success) {
    return { ok: false, message: "Some suggested rows looked off — please review and retry." };
  }

  const supabase = await createClient();
  const { data: roles } = await supabase
    .from("roles_certifications")
    .select("id, name")
    .eq("org_id", activeOrg.id);
  const resolved = resolveStaffingRoles(valid.data, (roles ?? []) as Array<{ id: string; name: string }>);

  const del = await supabase
    .from("staffing_requirements")
    .delete()
    .eq("org_id", activeOrg.id)
    .eq("source", "forecast");
  if (del.error) {
    logger.error("saveStaffingForecast: delete failed", { err: del.error, orgId: activeOrg.id });
    return { ok: false, message: del.error.message };
  }

  if (resolved.length > 0) {
    const ins = await supabase.from("staffing_requirements").insert(
      resolved.map((r) => ({
        org_id: activeOrg.id,
        role_certification_id: r.role_certification_id,
        day_of_week: r.day_of_week,
        start_time: r.start_time,
        end_time: r.end_time,
        min_staff: r.min_staff,
        source: "forecast",
      })),
    );
    if (ins.error) {
      logger.error("saveStaffingForecast: insert failed", { err: ins.error, orgId: activeOrg.id });
      return { ok: false, message: ins.error.message };
    }
  }

  revalidatePath("/scheduling");
  return { ok: true, message: "Forecast saved as suggested staffing." };
}
