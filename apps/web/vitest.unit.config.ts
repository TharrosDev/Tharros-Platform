import { fileURLToPath } from "node:url";

import { config } from "dotenv";
import { defineConfig } from "vitest/config";

config({ path: ".env.local" });
process.env.SKIP_ENV_VALIDATION ||= "true";

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
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "e2e/**",
      "**/*.live.ts",
      "**/*.db.test.ts",
      "**/*-rls.test.ts",
      "src/lib/supabase/__tests__/rls.test.ts",
      "src/lib/jobs/__tests__/jobs.test.ts",
      "src/lib/__tests__/rate-limit.test.ts",
      // Legacy live-Supabase harnesses predate the *.db / *-rls naming
      // convention. Keep them out of the deterministic unit lane.
      "src/lib/org/__tests__/org.test.ts",
      "src/lib/team/__tests__/team.test.ts",
    ],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: true,
  },
});
