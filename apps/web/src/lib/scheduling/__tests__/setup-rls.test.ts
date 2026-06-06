import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Day 43 — complete_scheduling_setup RPC harness (live, provider-free).
 *
 * Proves the wizard's single persistence path: owner/admin-only, transactional,
 * idempotent. Mirrors the Day-41 scheduling-rls harness; runs in CI against the
 * test Supabase project. Run with `pnpm --filter @tharros/web test`.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY!;

const PASSWORD = "Test-Pw-Day43-aA1!";
const RUN = Date.now().toString(36);
const emailFor = (who: string) => `setup-test-${RUN}-${who}@tharros-sched.test`;

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
  const { error } = await client.auth.signInWithPassword({
    email: emailFor(who),
    password: PASSWORD,
  });
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

const PAYLOAD = {
  employees: [
    {
      name: "Jordan Lee",
      email: "jordan@setup.test",
      employment_type: "full_time",
      role: "Server",
      is_minor: false,
    },
    {
      name: "Sam Park",
      email: "sam@setup.test",
      employment_type: "part_time",
      role: "Server",
      is_minor: true,
    },
  ],
  businessHours: [0, 1, 2, 3, 4, 5, 6].map((d) => ({
    day_of_week: d,
    opens_at: d === 0 ? "" : "09:00",
    closes_at: d === 0 ? "" : "17:00",
    is_closed: d === 0,
  })),
  staffing: [1, 2, 3, 4, 5, 6].map((d) => ({
    day_of_week: d,
    start_time: "09:00",
    end_time: "17:00",
    min_staff: 2,
    role: "Server",
  })),
  labor: {
    preset: "ontario",
    max_daily_hours: 8,
    max_weekly_hours: 48,
    min_rest_hours_between_shifts: 11,
    overtime_threshold_weekly: 44,
    max_consecutive_days: 6,
    minor_max_daily_hours: 8,
    minor_earliest_start: "06:00",
    minor_latest_end: "23:00",
  },
  persona: { tone: "friendly", notes: "Greet by first name." },
};

function rpcArgs(org: string) {
  return {
    p_org: org,
    p_employees: PAYLOAD.employees,
    p_business_hours: PAYLOAD.businessHours,
    p_staffing: PAYLOAD.staffing,
    p_labor: PAYLOAD.labor,
    p_persona: PAYLOAD.persona,
  };
}

let ownerId = "";
let memberId = "";
let orgA = "";
let ownerClient: SupabaseClient;
let memberClient: SupabaseClient;

beforeAll(async () => {
  [ownerId, memberId] = await Promise.all([seedUser("owner"), seedUser("member")]);
  orgA = await ownOrgId(ownerId);
  const { error } = await admin
    .from("memberships")
    .insert({ user_id: memberId, org_id: orgA, role: "member" });
  if (error) throw error;
  [ownerClient, memberClient] = await Promise.all([asUser("owner"), asUser("member")]);
});

afterAll(async () => {
  await admin.from("organizations").delete().eq("id", orgA);
  for (const id of [ownerId, memberId].filter(Boolean)) {
    await admin.auth.admin.deleteUser(id);
  }
});

describe("complete_scheduling_setup", () => {
  it("a plain member cannot run it", async () => {
    const { error } = await memberClient.rpc("complete_scheduling_setup", rpcArgs(orgA));
    expect(error).not.toBeNull();
  });

  it("an owner persists the whole payload and stamps the completion flag", async () => {
    const { error } = await ownerClient.rpc("complete_scheduling_setup", rpcArgs(orgA));
    expect(error).toBeNull();

    const [emps, hours, staffing, labor, settings] = await Promise.all([
      admin.from("employees").select("email, is_minor").eq("org_id", orgA),
      admin.from("business_hours").select("day_of_week, is_closed").eq("org_id", orgA),
      admin.from("staffing_requirements").select("id").eq("org_id", orgA).eq("source", "manual"),
      admin
        .from("labor_rules")
        .select("preset, min_rest_hours_between_shifts")
        .eq("org_id", orgA)
        .single(),
      admin
        .from("org_settings")
        .select("scheduling_onboarded_at, agent_persona")
        .eq("org_id", orgA)
        .single(),
    ]);

    expect((emps.data ?? []).length).toBe(2);
    expect((emps.data ?? []).find((e) => e.email === "sam@setup.test")?.is_minor).toBe(true);
    expect((hours.data ?? []).length).toBe(7);
    expect((hours.data ?? []).find((h) => h.day_of_week === 0)?.is_closed).toBe(true);
    expect((staffing.data ?? []).length).toBe(6);
    expect(labor.data?.preset).toBe("ontario");
    expect(Number(labor.data?.min_rest_hours_between_shifts)).toBe(11);
    expect(settings.data?.scheduling_onboarded_at).not.toBeNull();
    expect((settings.data?.agent_persona as { tone?: string })?.tone).toBe("friendly");
  });

  it("is idempotent — re-running does not duplicate rows", async () => {
    const { error } = await ownerClient.rpc("complete_scheduling_setup", rpcArgs(orgA));
    expect(error).toBeNull();

    const [emps, hours, staffing] = await Promise.all([
      admin.from("employees").select("id").eq("org_id", orgA),
      admin.from("business_hours").select("id").eq("org_id", orgA),
      admin.from("staffing_requirements").select("id").eq("org_id", orgA).eq("source", "manual"),
    ]);
    expect((emps.data ?? []).length).toBe(2);
    expect((hours.data ?? []).length).toBe(7);
    expect((staffing.data ?? []).length).toBe(6);
  });
});
