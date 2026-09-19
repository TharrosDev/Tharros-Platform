import { fileURLToPath } from "node:url";

import { config } from "dotenv";
import { defineConfig } from "vitest/config";

config({ path: ".env.local" });
process.env.SKIP_ENV_VALIDATION ||= "true";

// Every suite in this lane talks to the dedicated Supabase test project and
// builds its service-role client at module scope, so a missing credential is a
// collection-time crash rather than a skipped test. CI already gates the job on
// project reachability; mirror that locally by collecting nothing when the
// credentials are absent, so `pnpm test` stays runnable without them.
const LIVE_DB = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY,
);

if (!LIVE_DB) {
  console.warn(
    "[vitest] Skipping the live integration lane: NEXT_PUBLIC_SUPABASE_URL and/or " +
      "SUPABASE_SECRET_KEY are unset. This is an infrastructure warning, not release approval.",
  );
}

const INTEGRATION_SUITES = [
  "src/**/*.db.test.ts",
  "src/**/*-rls.test.ts",
  "src/lib/supabase/__tests__/rls.test.ts",
  "src/lib/jobs/__tests__/jobs.test.ts",
  "src/lib/__tests__/rate-limit.test.ts",
  // Legacy live-Supabase harnesses predate the *.db / *-rls naming
  // convention but belong in the same serialized integration lane.
  "src/lib/org/__tests__/org.test.ts",
  "src/lib/team/__tests__/team.test.ts",
];

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(
        new URL("./vitest.server-only.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    include: LIVE_DB ? INTEGRATION_SUITES : [],
    passWithNoTests: true,
    exclude: ["**/node_modules/**", "**/dist/**", "e2e/**", "**/*.live.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
});
