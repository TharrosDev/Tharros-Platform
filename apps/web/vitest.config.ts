import { fileURLToPath } from "node:url";

import { config } from "dotenv";
import { defineConfig } from "vitest/config";

// Integration tests run against the live Supabase project, so load the same
// .env.local the app uses (publishable key for user-session clients, the
// service-role SUPABASE_SECRET_KEY for seeding/teardown).
config({ path: ".env.local" });

// Pure unit suites (e.g. lib/billing/plans) import `@/env`, whose t3-env schema
// requires the full set of server secrets. CI's test job only supplies the
// Supabase vars, so skip presence-validation here — the DB harnesses read raw
// process.env directly and are unaffected. (Same stance as the CI build step.)
process.env.SKIP_ENV_VALIDATION ||= "true";

export default defineConfig({
  // Resolve the app's `@/*` path alias so unit tests can import app modules.
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    // The Playwright E2E specs live in e2e/ and use the @playwright/test runner —
    // keep Vitest out of them (its default glob would otherwise grab *.spec.ts).
    exclude: ["**/node_modules/**", "**/dist/**", "e2e/**"],
    // RLS tests do real network round-trips and seed/tear-down auth users.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Keep DB-touching suites serial to avoid cross-test interference.
    fileParallelism: false,
  },
});
