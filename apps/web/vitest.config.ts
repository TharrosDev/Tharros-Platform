import { config } from "dotenv";
import { defineConfig } from "vitest/config";

// Integration tests run against the live Supabase project, so load the same
// .env.local the app uses (publishable key for user-session clients, the
// service-role SUPABASE_SECRET_KEY for seeding/teardown).
config({ path: ".env.local" });

export default defineConfig({
  test: {
    environment: "node",
    // RLS tests do real network round-trips and seed/tear-down auth users.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Keep DB-touching suites serial to avoid cross-test interference.
    fileParallelism: false,
  },
});
