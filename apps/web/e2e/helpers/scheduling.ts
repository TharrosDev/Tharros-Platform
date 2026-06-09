import { admin } from "./supabase";

/**
 * Day 63 — scheduling E2E seeders. Same philosophy as helpers/supabase.ts: seed
 * the exact ground truth the real flows persist (service-role, bypassing RLS)
 * against the dedicated TEST project, so the spine can drive + assert the manager
 * and employee-portal surfaces without running the DeepSeek-dependent generation
 * (that path has a deterministic fallback and is covered by the Vitest db tests).
 */

/** Mark scheduling onboarding complete (the marker the `/scheduling` gate reads). */
export async function completeSchedulingOnboarding(orgId: string): Promise<void> {
  const { error } = await admin.from("org_settings").upsert(
    {
      org_id: orgId,
      scheduling_onboarded_at: new Date().toISOString(),
      agent_persona: { tone: "professional", notes: "" },
    },
    { onConflict: "org_id" },
  );
  if (error) throw error;
}

/** Insert an active employee on the roster. Returns its id. */
export async function seedEmployee(orgId: string, name: string, email: string): Promise<string> {
  const { data, error } = await admin
    .from("employees")
    .insert({ org_id: orgId, name, email, active: true })
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

/** Insert a role (roles_certifications kind='role'). Returns its id. */
export async function seedRole(orgId: string, name: string): Promise<string> {
  const { data, error } = await admin
    .from("roles_certifications")
    .insert({ org_id: orgId, name, kind: "role" })
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

/** Grant an employee whole-week permanent availability (so the availability surface isn't empty). */
export async function seedWholeWeekAvailability(orgId: string, employeeId: string): Promise<void> {
  const rows = Array.from({ length: 7 }, (_, dow) => ({
    org_id: orgId,
    employee_id: employeeId,
    kind: "permanent",
    day_of_week: dow,
    is_available: true,
    start_time: null,
    end_time: null,
  }));
  const { error } = await admin.from("availability").insert(rows);
  if (error) throw error;
}

export type SeededSchedule = { scheduleId: string; shiftIds: string[] };

/**
 * Seed a PUBLISHED schedule covering the next two weeks with one published shift
 * per given employee a few days out (09:00–13:00 UTC, inside one day). Returns the
 * schedule + shift ids. This is the shape the Day-49 panel + Day-51 publish land
 * on — enough for the calendar, the portal schedule, and analytics to render.
 */
export async function seedPublishedSchedule(
  orgId: string,
  employeeIds: string[],
): Promise<SeededSchedule> {
  const day = 24 * 60 * 60 * 1000;
  const todayIso = new Date().toISOString().slice(0, 10);
  const endIso = new Date(Date.now() + 14 * day).toISOString().slice(0, 10);

  const { data: sched, error: schedErr } = await admin
    .from("schedules")
    .insert({
      org_id: orgId,
      name: "E2E published schedule",
      period_start: todayIso,
      period_end: endIso,
      status: "published",
      published_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (schedErr) throw schedErr;
  const scheduleId = (sched as { id: string }).id;

  const shiftIds: string[] = [];
  for (let i = 0; i < employeeIds.length; i++) {
    // Each employee's shift on a distinct upcoming day, fixed 09:00–13:00 UTC.
    const date = new Date(Date.now() + (i + 2) * day).toISOString().slice(0, 10);
    const { data: shift, error: shiftErr } = await admin
      .from("shifts")
      .insert({
        org_id: orgId,
        schedule_id: scheduleId,
        employee_id: employeeIds[i],
        starts_at: `${date}T09:00:00Z`,
        ends_at: `${date}T13:00:00Z`,
        break_minutes: 0,
        status: "published",
      })
      .select("id")
      .single();
    if (shiftErr) throw shiftErr;
    shiftIds.push((shift as { id: string }).id);
  }

  return { scheduleId, shiftIds };
}

/**
 * Mint a portal access token for an employee (the row `issue_portal_token` would
 * write). Returns the raw token for the `/portal/enter?token=` magic link.
 */
export async function seedPortalToken(orgId: string, employeeId: string): Promise<string> {
  const token = `e2e-portal-${employeeId}-${Date.now().toString(36)}`;
  const { error } = await admin.from("employee_portal_tokens").insert({
    org_id: orgId,
    employee_id: employeeId,
    token,
    expires_at: new Date(Date.now() + 30 * 86_400_000).toISOString(),
  });
  if (error) throw error;
  return token;
}
