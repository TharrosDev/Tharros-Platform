import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createNotification } from "@/lib/notifications/notify";

/**
 * Day 40 — notification_events RLS + createNotification harness.
 *
 * RLS: a recipient sees / updates / deletes only their OWN notifications; another
 * member of the same org and a user from another org see none; users cannot
 * insert (system-created only). createNotification (service-role path): records
 * the inbox row, gates email on the org preference, and enqueues a
 * `notification-send` job only when the email is `pending`. Mirrors the
 * conversations/jobs harnesses: service-role seeds, user-session clients assert.
 *
 * Run with `pnpm --filter @tharros/web test`.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY!;

const PASSWORD = "Test-Pw-Day40-aA1!";
const RUN = Date.now().toString(36);
const emailFor = (who: string) => `notif-rls-${RUN}-${who}@tharros-rls.test`;

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

let userA = ""; // recipient (owner org A)
let userC = ""; // other member of org A
let userB = ""; // owner of org B
let orgA = "";
let notifA = ""; // a notification for userA

let clientA: SupabaseClient;
let clientB: SupabaseClient;
let clientC: SupabaseClient;

beforeAll(async () => {
  userA = await seedUser("recipientA");
  userC = await seedUser("memberC");
  userB = await seedUser("ownerB");
  orgA = await ownOrgId(userA);

  await admin.from("memberships").insert({ user_id: userC, org_id: orgA, role: "member" });

  const { data, error } = await admin
    .from("notification_events")
    .insert({ org_id: orgA, user_id: userA, type: "system", title: `n ${RUN}`, body: "hello" })
    .select("id")
    .single();
  if (error) throw error;
  notifA = data.id as string;

  clientA = await asUser(emailFor("recipientA"));
  clientB = await asUser(emailFor("ownerB"));
  clientC = await asUser(emailFor("memberC"));
}, 30_000);

afterAll(async () => {
  await admin.from("notification_events").delete().eq("org_id", orgA);
  await admin.from("jobs").delete().eq("org_id", orgA);
  await admin.auth.admin.deleteUser(userA).catch(() => {});
  await admin.auth.admin.deleteUser(userB).catch(() => {});
  await admin.auth.admin.deleteUser(userC).catch(() => {});
});

describe("notification_events RLS", () => {
  it("the recipient sees their own notification", async () => {
    const { data } = await clientA.from("notification_events").select("id").eq("id", notifA);
    expect(data?.map((r) => r.id)).toContain(notifA);
  });

  it("another member of the same org does NOT see it", async () => {
    const { data } = await clientC.from("notification_events").select("id").eq("id", notifA);
    expect(data ?? []).toHaveLength(0);
  });

  it("a user from another org does NOT see it", async () => {
    const { data } = await clientB.from("notification_events").select("id").eq("id", notifA);
    expect(data ?? []).toHaveLength(0);
  });

  it("the recipient can mark their own notification read", async () => {
    const { error } = await clientA
      .from("notification_events")
      .update({ read_at: new Date().toISOString() })
      .eq("id", notifA);
    expect(error).toBeNull();
    const { data } = await admin
      .from("notification_events")
      .select("read_at")
      .eq("id", notifA)
      .single();
    expect(data?.read_at).not.toBeNull();
  });

  it("a user cannot insert a notification (system-created only)", async () => {
    const { error } = await clientA
      .from("notification_events")
      .insert({ org_id: orgA, user_id: userA, type: "system", title: "x", body: "y" })
      .select("id")
      .single();
    expect(error).not.toBeNull();
  });

  it("the recipient can dismiss (delete) their own notification", async () => {
    const { data: created } = await admin
      .from("notification_events")
      .insert({ org_id: orgA, user_id: userA, type: "system", title: "tmp", body: "z" })
      .select("id")
      .single();
    const id = (created as { id: string }).id;
    const { error } = await clientA.from("notification_events").delete().eq("id", id);
    expect(error).toBeNull();
    const { data } = await admin.from("notification_events").select("id").eq("id", id);
    expect(data ?? []).toHaveLength(0);
  });
});

describe("createNotification (service-role)", () => {
  it("in-app only → email_status 'none', no job enqueued", async () => {
    const res = await createNotification(admin, {
      orgId: orgA,
      userId: userA,
      type: "system",
      title: "inapp",
      body: "b",
    });
    expect(res.emailStatus).toBe("none");
    const { data: jobs } = await admin
      .from("jobs")
      .select("id, payload")
      .eq("type", "notification-send")
      .eq("org_id", orgA);
    const matched = (jobs ?? []).filter(
      (j) => (j.payload as { notificationId?: string }).notificationId === res.id,
    );
    expect(matched).toHaveLength(0);
  });

  it("email on an ungated type → 'pending' + a notification-send job", async () => {
    const res = await createNotification(admin, {
      orgId: orgA,
      userId: userA,
      type: "system",
      title: "emailme",
      body: "b",
      email: true,
    });
    expect(res.emailStatus).toBe("pending");
    const { data: jobs } = await admin
      .from("jobs")
      .select("payload")
      .eq("type", "notification-send")
      .eq("org_id", orgA);
    const matched = (jobs ?? []).filter(
      (j) => (j.payload as { notificationId?: string }).notificationId === res.id,
    );
    expect(matched).toHaveLength(1);
  });

  it("email gated off by the org preference → 'skipped', no job", async () => {
    await admin
      .from("org_settings")
      .upsert({ org_id: orgA, notifications: { billing_account: false } }, { onConflict: "org_id" });

    const res = await createNotification(admin, {
      orgId: orgA,
      userId: userA,
      type: "billing",
      title: "receipt",
      body: "b",
      email: true,
    });
    expect(res.emailStatus).toBe("skipped");
    const { data: jobs } = await admin
      .from("jobs")
      .select("payload")
      .eq("type", "notification-send")
      .eq("org_id", orgA);
    const matched = (jobs ?? []).filter(
      (j) => (j.payload as { notificationId?: string }).notificationId === res.id,
    );
    expect(matched).toHaveLength(0);
  });
});
