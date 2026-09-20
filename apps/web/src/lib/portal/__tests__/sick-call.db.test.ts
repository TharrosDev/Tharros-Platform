import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DeepSeekChat, DeepSeekChatResponse } from "@/lib/deepseek/structured";
import { processSickCall } from "@/lib/scheduling/sick-call";

/**
 * Day 54 — sick-call orchestration harness (live, against the CI Supabase project).
 *
 * `processSickCall` is the DI'd core (admin client + injected DeepSeek `chat`), so
 * this drives it directly — the portal action is just a cookie-session wrapper. It
 * proves the end-to-end side effects: the event is recorded, the shift is vacated,
 * the kind='sick_call' thread + turns are written, the manager is notified, and the
 * audit row lands. Provider-free (a fake `chat`). Run with
 * `pnpm --filter @tharros/web test`.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY!;

const PASSWORD = "Test-Pw-Day54-aA1!";
const RUN = Date.now().toString(36);
const emailFor = (who: string) => `sick-call-${RUN}-${who}@tharros-sched.test`;

const admin = createClient(SUPABASE_URL, SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const DAY = 24 * 60 * 60 * 1000;
const isoIn = (days: number) => new Date(Date.now() + days * DAY).toISOString();

let ownerId = "";
let orgA = "";
let emp1 = "";
let emp2 = "";
let scheduleId = "";

/** Fake DeepSeek: always records a confirmation with a normalized reason. */
function fakeChat(): DeepSeekChat {
  const resp: DeepSeekChatResponse = {
    model: "deepseek-v4-flash",
    choices: [
      {
        message: {
          content: null,
          tool_calls: [
            {
              id: "c1",
              type: "function",
              function: {
                name: "record_sick_call",
                arguments: JSON.stringify({
                  normalizedReason: "Illness",
                  confirmationMessage: "Thanks, we've told your manager and we'll find cover.",
                  category: "illness",
                }),
              },
            },
          ],
        },
      },
    ],
    usage: { prompt_tokens: 100, completion_tokens: 20, prompt_cache_miss_tokens: 100 },
  };
  return async () => resp;
}

async function addShift(employeeId: string, startDays: number, status = "published") {
  const { data, error } = await admin
    .from("shifts")
    .insert({
      org_id: orgA,
      schedule_id: scheduleId,
      employee_id: employeeId,
      starts_at: isoIn(startDays),
      ends_at: isoIn(startDays + 0.33),
      break_minutes: 0,
      status,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data!.id as string;
}

beforeAll(async () => {
  const { data: u, error: uErr } = await admin.auth.admin.createUser({
    email: emailFor("owner"),
    password: PASSWORD,
    email_confirm: true,
  });
  if (uErr) throw uErr;
  ownerId = u.user.id;

  const { data: m, error: mErr } = await admin
    .from("memberships")
    .select("org_id")
    .eq("user_id", ownerId)
    .eq("role", "owner")
    .single();
  if (mErr) throw mErr;
  orgA = m.org_id as string;

  const { data: emps, error: eErr } = await admin
    .from("employees")
    .insert([
      { org_id: orgA, name: "Sam Worker", email: `e1-${RUN}@tharros-sched.test` },
      { org_id: orgA, name: "Other Worker", email: `e2-${RUN}@tharros-sched.test` },
    ])
    .select("id");
  if (eErr) throw eErr;
  emp1 = emps![0].id as string;
  emp2 = emps![1].id as string;

  const { data: sched, error: sErr } = await admin
    .from("schedules")
    .insert({
      org_id: orgA,
      name: "Sick-call sched",
      period_start: isoIn(0).slice(0, 10),
      period_end: isoIn(30).slice(0, 10),
      status: "published",
    })
    .select("id")
    .single();
  if (sErr) throw sErr;
  scheduleId = sched!.id as string;
}, 30_000);

afterAll(async () => {
  // Children first (FKs), then the org-scoped audit/notifications/jobs, then roster.
  if (scheduleId) await admin.from("schedules").delete().eq("id", scheduleId);
  if (orgA) {
    await admin.from("sick_call_events").delete().eq("org_id", orgA);
    await admin.from("ai_conversation_threads").delete().eq("org_id", orgA);
    await admin.from("notification_events").delete().eq("org_id", orgA);
    await admin.from("scheduling_audit_log").delete().eq("org_id", orgA);
    await admin.from("jobs").delete().eq("org_id", orgA);
  }
  if (emp1) await admin.from("employees").delete().eq("id", emp1);
  if (emp2) await admin.from("employees").delete().eq("id", emp2);
  await admin.auth.admin.deleteUser(ownerId).catch(() => {});
});

describe("processSickCall", () => {
  it("records the call-out, vacates the shift, opens a thread, and notifies the manager", async () => {
    const shiftId = await addShift(emp1, 3);

    const result = await processSickCall(
      admin,
      {
        employeeId: emp1,
        orgId: orgA,
        employeeName: "Sam Worker",
        shiftId,
        reasonText: "I'm sick",
      },
      { chat: fakeChat() },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // The sick-call event was recorded with the normalized reason. Day 55:
    // processSickCall now chains into the replacement engine — with no other
    // eligible employee in this fixture (the second worker has no availability),
    // it escalates immediately rather than leaving the event 'open'.
    const { data: sc } = await admin
      .from("sick_call_events")
      .select("id, status, shift_id, notes, employee_id")
      .eq("id", result.sickCallId)
      .single();
    expect(sc!.status).toBe("escalated");
    expect(sc!.shift_id).toBe(shiftId);
    expect(sc!.employee_id).toBe(emp1);
    expect(sc!.notes).toBe("Illness");

    // The shift was vacated and reopened.
    const { data: shift } = await admin
      .from("shifts")
      .select("employee_id, status")
      .eq("id", shiftId)
      .single();
    expect(shift!.employee_id).toBeNull();
    expect(shift!.status).toBe("open");

    // A sick_call thread + two turns were written.
    expect(result.threadId).toBeTruthy();
    const { data: thread } = await admin
      .from("ai_conversation_threads")
      .select("kind, mode, status")
      .eq("id", result.threadId!)
      .single();
    expect(thread!.kind).toBe("sick_call");
    const { data: turns } = await admin
      .from("agent_turns")
      .select("role")
      .eq("thread_id", result.threadId!);
    expect((turns ?? []).length).toBe(2);

    // The owner (a manager) got a sick_call notification.
    const { data: notes } = await admin
      .from("notification_events")
      .select("user_id, type")
      .eq("org_id", orgA)
      .eq("type", "sick_call");
    expect((notes ?? []).some((n) => n.user_id === ownerId)).toBe(true);

    // The audit trail captured it.
    const { data: audit } = await admin
      .from("scheduling_audit_log")
      .select("action, entity_id, actor_type")
      .eq("org_id", orgA)
      .eq("action", "sick_call.reported");
    expect((audit ?? []).some((a) => a.entity_id === result.sickCallId)).toBe(true);
    expect((audit ?? [])[0]?.actor_type).toBe("employee");
  });

  it("rejects when the org requires a reason and none is given", async () => {
    await admin
      .from("org_settings")
      .upsert(
        { org_id: orgA, agent_persona: { sickCallReason: "required" } },
        { onConflict: "org_id" },
      );

    const shiftId = await addShift(emp1, 5);
    const result = await processSickCall(
      admin,
      { employeeId: emp1, orgId: orgA, employeeName: "Sam Worker", shiftId },
      { chat: fakeChat() },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("reason_required");

    // The shift is untouched and no event was created.
    const { data: shift } = await admin
      .from("shifts")
      .select("employee_id, status")
      .eq("id", shiftId)
      .single();
    expect(shift!.employee_id).toBe(emp1);
    expect(shift!.status).toBe("published");

    // Reset the policy for any later assertions.
    await admin
      .from("org_settings")
      .upsert({ org_id: orgA, agent_persona: {} }, { onConflict: "org_id" });
  });

  it("rejects a shift that isn't the caller's", async () => {
    const otherShift = await addShift(emp2, 4);
    const result = await processSickCall(
      admin,
      { employeeId: emp1, orgId: orgA, employeeName: "Sam Worker", shiftId: otherShift },
      { chat: fakeChat() },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("not_found");
  });
});
