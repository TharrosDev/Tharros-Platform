import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { buildJobRow, enqueueJobs } from "@/lib/jobs/enqueue";

describe("buildJobRow", () => {
  it("defaults the payload to an empty object", () => {
    expect(buildJobRow({ type: "schedule-delivery" })).toEqual({
      type: "schedule-delivery",
      payload: {},
    });
  });

  it("omits optional columns so the table defaults apply", () => {
    const row = buildJobRow({ type: "shift-reminder", payload: { a: 1 } });
    expect(row).not.toHaveProperty("run_at");
    expect(row).not.toHaveProperty("max_attempts");
    expect(row).not.toHaveProperty("org_id");
  });

  it("serializes a Date runAt to ISO and passes a string through", () => {
    expect(
      buildJobRow({ type: "shift-reminder", runAt: new Date("2026-06-08T00:00:00.000Z") }).run_at,
    ).toBe("2026-06-08T00:00:00.000Z");
    expect(buildJobRow({ type: "shift-reminder", runAt: "2026-06-08T01:00:00Z" }).run_at).toBe(
      "2026-06-08T01:00:00Z",
    );
  });

  it("keeps an explicitly null orgId as a platform-wide job", () => {
    expect(buildJobRow({ type: "shift-reminder", orgId: null }).org_id).toBeNull();
  });
});

/** Minimal stand-in for the admin client's `from(...).insert(...).select(...)` chain. */
function fakeAdmin(result: { data?: unknown; error?: unknown }) {
  const insert = vi.fn((_rows: unknown) => ({ select: vi.fn(async () => result) }));
  return { client: { from: vi.fn(() => ({ insert })) } as unknown as SupabaseClient, insert };
}

describe("enqueueJobs", () => {
  it("does not touch the database for an empty batch", async () => {
    const { client, insert } = fakeAdmin({ data: [] });
    await expect(enqueueJobs(client, [])).resolves.toEqual([]);
    expect(insert).not.toHaveBeenCalled();
  });

  it("sends every row in a single insert and returns the new ids", async () => {
    const { client, insert } = fakeAdmin({ data: [{ id: "j1" }, { id: "j2" }] });
    const ids = await enqueueJobs(client, [
      { type: "schedule-delivery", payload: { employeeId: "e1" }, orgId: "org1" },
      { type: "schedule-delivery", payload: { employeeId: "e2" }, orgId: "org1" },
    ]);

    expect(ids).toEqual(["j1", "j2"]);
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert.mock.calls[0][0]).toEqual([
      { type: "schedule-delivery", payload: { employeeId: "e1" }, org_id: "org1" },
      { type: "schedule-delivery", payload: { employeeId: "e2" }, org_id: "org1" },
    ]);
  });

  it("throws when the insert fails", async () => {
    const { client } = fakeAdmin({ error: new Error("insert failed") });
    await expect(enqueueJobs(client, [{ type: "shift-reminder" }])).rejects.toThrow(
      "insert failed",
    );
  });
});
