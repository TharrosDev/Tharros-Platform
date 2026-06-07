import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { enqueueJob } from "@/lib/jobs/enqueue";
import { runDueJobs } from "@/lib/jobs/runner";

/**
 * Day 38 — durable job runtime harness.
 *
 * Exercises the claim/reap RPCs and the TS runner against the dedicated CI test
 * Supabase project, using a service-role client (the deny-all `jobs` table's only
 * accessor). Provider-free. claim_due_jobs/reap_stuck_jobs are GLOBAL queries, so
 * the harness owns the whole table: `clearAllJobs` (beforeEach/afterAll) wipes it
 * to stay isolated from prior runs. Safe because no app writes the test project's
 * `jobs` table.
 *
 * Run with `pnpm --filter @tharros/web test`.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY!;

const RUN = Date.now().toString(36);

const admin: SupabaseClient = createClient(SUPABASE_URL, SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// claim_due_jobs / reap_stuck_jobs operate GLOBALLY (they're the real worker
// queries), so these tests are only deterministic on an empty table. The CI test
// project's `jobs` table is owned exclusively by this harness (no app writes it),
// so clear ALL rows — not just this run's — to stay isolated from prior runs.
async function clearAllJobs() {
  await admin.from("jobs").delete().neq("id", "00000000-0000-0000-0000-000000000000");
}

async function getJob(id: string) {
  const { data, error } = await admin.from("jobs").select("*").eq("id", id).single();
  if (error) throw error;
  return data as {
    status: string;
    attempts: number;
    last_error: string | null;
    locked_at: string | null;
    run_at: string;
  };
}

beforeEach(clearAllJobs);
afterAll(clearAllJobs);

describe("runDueJobs — happy path", () => {
  it("runs a due noop job to succeeded", async () => {
    const id = await enqueueJob(admin, { type: "noop", payload: { run: RUN } });

    const summary = await runDueJobs(admin);
    expect(summary.claimed).toBeGreaterThanOrEqual(1);
    expect(summary.succeeded).toBeGreaterThanOrEqual(1);

    const job = await getJob(id);
    expect(job.status).toBe("succeeded");
    expect(job.attempts).toBe(1);
    expect(job.locked_at).toBeNull();
  });

  it("does not claim a future-dated job", async () => {
    const future = new Date(Date.now() + 3_600_000);
    const id = await enqueueJob(admin, { type: "noop", payload: { run: RUN }, runAt: future });

    await runDueJobs(admin);

    const job = await getJob(id);
    expect(job.status).toBe("pending");
    expect(job.attempts).toBe(0);
  });
});

describe("runDueJobs — failure handling", () => {
  it("retries then dies when a job has no handler", async () => {
    // "willfail" has no registered handler → the runner treats it as a failure.
    // Inserted directly (it's deliberately not a known JobType).
    const { data: created } = await admin
      .from("jobs")
      .insert({ type: "willfail", payload: { run: RUN }, max_attempts: 2 })
      .select("id")
      .single();
    const id = (created as { id: string }).id;

    // First run: attempt 1 fails → retry (pending, future run_at, backoff).
    const first = await runDueJobs(admin);
    expect(first.failed).toBeGreaterThanOrEqual(1);
    let job = await getJob(id);
    expect(job.status).toBe("pending");
    expect(job.attempts).toBe(1);
    expect(job.last_error).toContain("No handler");
    expect(new Date(job.run_at).getTime()).toBeGreaterThan(Date.now());

    // Make it due again and re-run: attempt 2 == max_attempts → dead.
    await admin.from("jobs").update({ run_at: new Date().toISOString() }).eq("id", id);
    const second = await runDueJobs(admin);
    expect(second.dead).toBeGreaterThanOrEqual(1);
    job = await getJob(id);
    expect(job.status).toBe("dead");
    expect(job.attempts).toBe(2);
  });
});

describe("claim_due_jobs — atomic claim", () => {
  it("claims its own due jobs up to the limit, leaving the rest", async () => {
    // The CI `jobs` table is shared with the concurrently-running e2e job (and
    // other PRs), so foreign due rows can appear between the beforeEach wipe and
    // the claim below. claim_due_jobs is a GLOBAL query, so asserting exact global
    // counts is racy (the historical flake). Isolate by asserting only on THIS
    // run's rows by id: back-date them a day so they sort ahead of any app-
    // enqueued job (which uses run_at≈now), and since claim_due_jobs orders by
    // run_at, the oldest-due rows it returns are deterministically ours.
    const past = (sec: number) =>
      new Date(Date.now() - 86_400_000 + sec * 1000).toISOString();
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) {
      const { data, error } = await admin
        .from("jobs")
        .insert({ type: "noop", payload: { run: RUN }, run_at: past(i) })
        .select("id")
        .single();
      if (error) throw error;
      ids.push((data as { id: string }).id);
    }

    // Claim 2 → our two oldest, and never more than the limit.
    const { data: first, error } = await admin.rpc("claim_due_jobs", { p_limit: 2 });
    expect(error).toBeNull();
    const firstIds = ((first ?? []) as Array<{ id: string }>).map((j) => j.id);
    expect(firstIds.length).toBeLessThanOrEqual(2); // respects the limit
    expect(firstIds).toContain(ids[0]);
    expect(firstIds).toContain(ids[1]);
    expect(firstIds).not.toContain(ids[2]);

    // Each claimed row is marked running, attempts incremented, lock held.
    for (const id of [ids[0], ids[1]]) {
      const job = await getJob(id);
      expect(job.status).toBe("running");
      expect(job.attempts).toBe(1);
      expect(job.locked_at).not.toBeNull();
    }

    // The third was untouched and is still claimable on the next pass (SKIP LOCKED).
    expect((await getJob(ids[2])).status).toBe("pending");
    const { data: second } = await admin.rpc("claim_due_jobs", { p_limit: 2 });
    const secondIds = ((second ?? []) as Array<{ id: string }>).map((j) => j.id);
    expect(secondIds).toContain(ids[2]);
  });
});

describe("reap_stuck_jobs — crash recovery", () => {
  it("requeues a stalled running job and kills one past max attempts", async () => {
    const stale = new Date(Date.now() - 10 * 60_000).toISOString(); // 10 min ago
    const { data: a } = await admin
      .from("jobs")
      .insert({
        type: "noop",
        payload: { run: RUN },
        status: "running",
        locked_at: stale,
        attempts: 1,
        max_attempts: 5,
      })
      .select("id")
      .single();
    const { data: b } = await admin
      .from("jobs")
      .insert({
        type: "noop",
        payload: { run: RUN },
        status: "running",
        locked_at: stale,
        attempts: 5,
        max_attempts: 5,
      })
      .select("id")
      .single();

    const { data: count, error } = await admin.rpc("reap_stuck_jobs");
    expect(error).toBeNull();
    expect(count as number).toBeGreaterThanOrEqual(2);

    const requeued = await getJob((a as { id: string }).id);
    expect(requeued.status).toBe("pending");
    expect(requeued.locked_at).toBeNull();

    const killed = await getJob((b as { id: string }).id);
    expect(killed.status).toBe("dead");
  });
});
