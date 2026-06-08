import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Day 52 — employee profile + role-certification RLS harness.
 *
 * The profile/role actions write `employees`, `roles_certifications`, and
 * `employee_role_assignments` through the user-session client, so the Day-37/41
 * owner/admin-write RLS is the real gate. Proves against the CI Supabase project:
 * a manager can edit profile columns, create a catalog role, and assign it; a
 * plain member can read the employee + assignments + attendance tables but none
 * of the writes take effect. Provider-free. Run with `pnpm --filter @tharros/web test`.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY!;

const PASSWORD = "Test-Pw-Day52-aA1!";
const RUN = Date.now().toString(36);
const emailFor = (who: string) => `emp-prof-${RUN}-${who}@tharros-sched.test`;

const admin = createClient(SUPABASE_URL, SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function seedUser(who: string): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({
    email: emailFor(who),
    password: PASSWORD,
    email_confirm: true,
  });
  if (error) throw error;
  return data.user.id;
}

async function asUser(who: string): Promise<SupabaseClient> {
  const client = createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email: emailFor(who), password: PASSWORD });
  if (error) throw error;
  return client;
}

async function ownOrgId(userId: string): Promise<string> {
  const { data, error } = await admin
    .from("memberships")
    .select("org_id")
    .eq("user_id", userId)
    .eq("role", "owner")
    .single();
  if (error) throw error;
  return data.org_id as string;
}

let ownerId = "";
let memberId = "";
let orgA = "";
let employeeId = "";
let roleId = "";

let ownerClient: SupabaseClient;
let memberClient: SupabaseClient;

beforeAll(async () => {
  [ownerId, memberId] = await Promise.all([seedUser("owner"), seedUser("member")]);
  orgA = await ownOrgId(ownerId);

  const { error: memErr } = await admin
    .from("memberships")
    .insert({ user_id: memberId, org_id: orgA, role: "member" });
  if (memErr) throw memErr;

  [ownerClient, memberClient] = await Promise.all([asUser("owner"), asUser("member")]);

  const { data: emp, error: empErr } = await ownerClient
    .from("employees")
    .insert({ org_id: orgA, name: "Profile Tester", email: `worker-${RUN}@tharros-sched.test` })
    .select("id")
    .single();
  if (empErr) throw empErr;
  employeeId = emp!.id as string;
}, 30_000);

afterAll(async () => {
  if (employeeId) await admin.from("employees").delete().eq("id", employeeId);
  await Promise.all([
    admin.auth.admin.deleteUser(ownerId).catch(() => {}),
    admin.auth.admin.deleteUser(memberId).catch(() => {}),
  ]);
});

describe("employee profile + roles (manager-write / member-read)", () => {
  it("a manager updates profile columns", async () => {
    const { error } = await ownerClient
      .from("employees")
      .update({
        employment_type: "full_time",
        seniority_rank: 2,
        performance_score: 91.5,
        is_minor: false,
        target_hours_weekly: 40,
      })
      .eq("id", employeeId);
    expect(error).toBeNull();

    const { data } = await admin
      .from("employees")
      .select("employment_type, performance_score")
      .eq("id", employeeId)
      .single();
    expect(data?.employment_type).toBe("full_time");
    expect(Number(data?.performance_score)).toBe(91.5);
  });

  it("a manager creates a catalog role and assigns it", async () => {
    const { data: role, error: roleErr } = await ownerClient
      .from("roles_certifications")
      .insert({ org_id: orgA, name: `Shift Lead ${RUN}`, kind: "role" })
      .select("id")
      .single();
    expect(roleErr).toBeNull();
    roleId = role!.id as string;

    const { error: assignErr } = await ownerClient
      .from("employee_role_assignments")
      .insert({ org_id: orgA, employee_id: employeeId, role_certification_id: roleId });
    expect(assignErr).toBeNull();

    const { data } = await ownerClient
      .from("employee_role_assignments")
      .select("id")
      .eq("employee_id", employeeId);
    expect((data ?? []).length).toBe(1);
  });

  it("a plain member can read the employee + role assignments + attendance tables", async () => {
    const { data: emp } = await memberClient
      .from("employees")
      .select("id, employment_type")
      .eq("id", employeeId)
      .maybeSingle();
    expect(emp?.employment_type).toBe("full_time");

    const { data: roles } = await memberClient
      .from("employee_role_assignments")
      .select("id")
      .eq("employee_id", employeeId);
    expect((roles ?? []).length).toBe(1);

    // Attendance tables are member-readable (empty for now).
    const { error: toErr } = await memberClient
      .from("time_off_requests")
      .select("id")
      .eq("employee_id", employeeId);
    expect(toErr).toBeNull();
  });

  it("a plain member cannot edit the profile or assign roles", async () => {
    await memberClient
      .from("employees")
      .update({ performance_score: 10 })
      .eq("id", employeeId);
    const { data } = await admin
      .from("employees")
      .select("performance_score")
      .eq("id", employeeId)
      .single();
    expect(Number(data?.performance_score)).toBe(91.5); // unchanged

    const { error: insErr } = await memberClient
      .from("roles_certifications")
      .insert({ org_id: orgA, name: `Sneaky ${RUN}`, kind: "role" })
      .select("id")
      .single();
    expect(insErr).not.toBeNull();
  });
});
