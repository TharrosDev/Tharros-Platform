import { createClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";

/**
 * Audit fix #3 — rate-limit RPC harness.
 *
 * Exercises public.check_rate_limit through a service-role client (the RPC is
 * SECURITY DEFINER and writes a no-policy table, so direct calls are fine for
 * the test). Mirrors the Day-11/15 harness setup.
 *
 * Run with `pnpm --filter @tharros/web test`.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient(SUPABASE_URL, SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const RUN = Date.now().toString(36);
const keyFor = (who: string) => `test:${RUN}:${who}`;

async function check(key: string, max: number, windowSeconds: number): Promise<boolean> {
  const { data, error } = await admin.rpc("check_rate_limit", {
    p_key: key,
    p_max: max,
    p_window_seconds: windowSeconds,
  });
  if (error) throw error;
  return data as boolean;
}

afterAll(async () => {
  await admin.from("rate_limit_events").delete().like("key", `test:${RUN}:%`);
});

describe("check_rate_limit", () => {
  it("allows up to max attempts then blocks within the window", async () => {
    const key = keyFor("burst");
    expect(await check(key, 3, 900)).toBe(true); // count 0 < 3
    expect(await check(key, 3, 900)).toBe(true); // count 1 < 3
    expect(await check(key, 3, 900)).toBe(true); // count 2 < 3
    expect(await check(key, 3, 900)).toBe(false); // count 3, not < 3
  });

  it("isolates separate keys", async () => {
    const a = keyFor("a");
    const b = keyFor("b");
    expect(await check(a, 1, 900)).toBe(true);
    expect(await check(a, 1, 900)).toBe(false);
    // b is untouched by a's hits.
    expect(await check(b, 1, 900)).toBe(true);
  });

  it("allows again after expired hits are pruned", async () => {
    const key = keyFor("window");
    const { error } = await admin.from("rate_limit_events").insert({
      key,
      created_at: new Date(Date.now() - 60_000).toISOString(),
    });
    expect(error).toBeNull();

    expect(await check(key, 1, 1)).toBe(true);
    expect(await check(key, 1, 1)).toBe(false);
  });

  it("serializes concurrent attempts for the same bucket", async () => {
    const key = keyFor("concurrent");
    const results = await Promise.all(Array.from({ length: 12 }, () => check(key, 3, 900)));

    expect(results.filter(Boolean)).toHaveLength(3);
    expect(results.filter((allowed) => !allowed)).toHaveLength(9);
  });
});
