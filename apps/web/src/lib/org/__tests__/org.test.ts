import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Day 12 — Org onboarding harness.
 *
 * Exercises the user-facing create/onboard RPCs and the active-org plumbing
 * through live user-session clients (the app's real path), with a service-role
 * client for seeding + ground truth. Mirrors the Day-11 RLS harness conventions.
 *
 * Run with `pnpm --filter @tharros/web test`.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY!;

const PASSWORD = "Test-Pw-Day12-aA1!";

const RUN = Date.now().toString(36);
const emailFor = (who: string) => `org-test-${RUN}-${who}@tharros-org.test`;

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

async function asUser(email: string): Promise<SupabaseClient> {
  const client = createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  return client;
}

/** The personal org auto-provisioned for a user by the signup trigger. */
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

let userA = "";
let userB = "";
let userC = "";
let orgA = "";
let orgB = "";

let clientA: SupabaseClient;
let clientB: SupabaseClient;
let clientC: SupabaseClient;

beforeAll(async () => {
  userA = await seedUser("a");
  userB = await seedUser("b");
  userC = await seedUser("c");

  orgA = await ownOrgId(userA);
  orgB = await ownOrgId(userB);

  // C is a plain member of org A.
  const { error } = await admin
    .from("memberships")
    .insert({ user_id: userC, org_id: orgA, role: "member" });
  if (error) throw error;

  clientA = await asUser(emailFor("a"));
  clientB = await asUser(emailFor("b"));
  clientC = await asUser(emailFor("c"));
});

afterAll(async () => {
  // Orgs first (cascade skips the last-owner guard), then users — per Day 11.
  const ids = [userA, userB, userC].filter(Boolean);
  if (ids.length) {
    const { data: orgs } = await admin
      .from("memberships")
      .select("org_id")
      .in("user_id", ids);
    const orgIds = [...new Set((orgs ?? []).map((m) => m.org_id))];
    for (const id of orgIds) {
      await admin.from("organizations").delete().eq("id", id);
    }
    for (const id of ids) {
      await admin.auth.admin.deleteUser(id);
    }
  }
});

describe("signup auto-provisioning (Day 12 additions)", () => {
  it("each new org has a settings row and sets the profile's active org", async () => {
    const { data: settings } = await admin
      .from("org_settings")
      .select("org_id, timezone, locale")
      .eq("org_id", orgA)
      .single();
    expect(settings?.org_id).toBe(orgA);
    expect(settings?.timezone).toBe("America/Toronto");
    expect(settings?.locale).toBe("en-CA");

    const { data: profile } = await admin
      .from("profiles")
      .select("current_org_id")
      .eq("id", userA)
      .single();
    expect(profile?.current_org_id).toBe(orgA);
  });

  it("a freshly provisioned org starts un-onboarded (onboarded_at is null)", async () => {
    const { data } = await admin
      .from("organizations")
      .select("onboarded_at")
      .eq("id", orgA)
      .single();
    expect(data?.onboarded_at).toBeNull();
  });
});

describe("complete_org_onboarding", () => {
  it("owner A finishes the wizard: identity saved + onboarded_at stamped", async () => {
    const { error } = await clientA.rpc("complete_org_onboarding", {
      p_org: orgA,
      p_name: "Acme Co",
      p_industry: "Technology",
      p_size: "2-10",
    });
    expect(error).toBeNull();

    const { data } = await admin
      .from("organizations")
      .select("name, industry, size, onboarded_at")
      .eq("id", orgA)
      .single();
    expect(data?.name).toBe("Acme Co");
    expect(data?.industry).toBe("Technology");
    expect(data?.size).toBe("2-10");
    expect(data?.onboarded_at).not.toBeNull();
  });

  it("a non-owner cannot complete onboarding for someone else's org", async () => {
    const { error } = await clientB.rpc("complete_org_onboarding", {
      p_org: orgA,
      p_name: "Hijacked",
      p_industry: "Technology",
      p_size: "1",
    });
    expect(error).not.toBeNull();
  });
});

describe("create_organization", () => {
  it("creates an org + owner membership + settings and switches the active org", async () => {
    const { data: newOrgId, error } = await clientA.rpc("create_organization", {
      p_name: "Second Workspace",
      p_industry: "Retail & E-commerce",
      p_size: "11-50",
    });
    expect(error).toBeNull();
    expect(typeof newOrgId).toBe("string");

    const { data: org } = await admin
      .from("organizations")
      .select("name, industry, size, onboarded_at, created_by")
      .eq("id", newOrgId)
      .single();
    expect(org?.name).toBe("Second Workspace");
    expect(org?.onboarded_at).not.toBeNull();
    expect(org?.created_by).toBe(userA);

    const { data: membership } = await admin
      .from("memberships")
      .select("role")
      .eq("user_id", userA)
      .eq("org_id", newOrgId)
      .single();
    expect(membership?.role).toBe("owner");

    const { data: settings } = await admin
      .from("org_settings")
      .select("org_id")
      .eq("org_id", newOrgId)
      .single();
    expect(settings?.org_id).toBe(newOrgId);

    const { data: profile } = await admin
      .from("profiles")
      .select("current_org_id")
      .eq("id", userA)
      .single();
    expect(profile?.current_org_id).toBe(newOrgId);
  });

  it("rejects a blank name", async () => {
    const { error } = await clientB.rpc("create_organization", { p_name: "   " });
    expect(error).not.toBeNull();
  });
});

describe("active org guard (profiles.current_org_id)", () => {
  it("A can point current_org_id at an org A belongs to", async () => {
    const { error } = await clientA
      .from("profiles")
      .update({ current_org_id: orgA })
      .eq("id", userA);
    expect(error).toBeNull();
  });

  it("A cannot point current_org_id at an org A does not belong to", async () => {
    // The before-update trigger raises a real exception (not an RLS 0-row denial).
    const { error } = await clientA
      .from("profiles")
      .update({ current_org_id: orgB })
      .eq("id", userA);
    expect(error).not.toBeNull();
  });
});

describe("org_settings RLS", () => {
  it("member C can read org A settings; outsider B cannot", async () => {
    const cRead = await clientC.from("org_settings").select("org_id").eq("org_id", orgA);
    expect(cRead.data?.map((s) => s.org_id)).toEqual([orgA]);

    const bRead = await clientB.from("org_settings").select("org_id").eq("org_id", orgA);
    expect(bRead.data).toEqual([]);
  });

  it("member C cannot update settings; owner A can", async () => {
    const cUpd = await clientC
      .from("org_settings")
      .update({ timezone: "America/Vancouver" })
      .eq("org_id", orgA)
      .select();
    expect(cUpd.data).toEqual([]);

    const aUpd = await clientA
      .from("org_settings")
      .update({ timezone: "America/Vancouver" })
      .eq("org_id", orgA)
      .select();
    expect(aUpd.error).toBeNull();
    expect(aUpd.data).toHaveLength(1);
  });
});
