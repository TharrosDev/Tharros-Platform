import { config as loadEnv } from "dotenv";
import { defineConfig, devices } from "@playwright/test";

/**
 * Day 22 — Playwright E2E config (the auth+billing "spine").
 *
 * Like the Vitest harnesses, the E2E suite drives the real app against a live
 * Supabase project — point env at the dedicated TEST project, never prod. Local
 * runs load `.env.local`; CI supplies env on the `e2e` job. The spec's Node-side
 * helpers (service-role seeding, deterministic subscription state via the Day-18
 * webhook handler) read the same vars the app does.
 *
 * Run: `pnpm --filter web build && pnpm --filter web test:e2e`
 * (the webServer below boots the built app with `next start`).
 */
loadEnv({ path: ".env.local" });

const PORT = Number(process.env.PORT ?? 3000);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`;
const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./e2e",
  // The spine is one ordered story; keep it serial and single-worker so the
  // shared seeded fixtures are deterministic.
  fullyParallel: false,
  workers: 1,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: isCI ? [["html", { open: "never" }], ["list"]] : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    video: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm start",
    url: baseURL,
    reuseExistingServer: !isCI,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
