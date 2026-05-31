import path from "node:path";
import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// Validate environment variables at the very start of every build and `dev`
// start. Next loads .env files before reading this config, so a missing or
// malformed required key fails fast here with a named error.
import "./src/env";

const nextConfig: NextConfig = {
  // Pin the Turbopack root to the monorepo so Next doesn't misinfer it from a
  // stray lockfile elsewhere on the machine.
  turbopack: {
    root: path.join(__dirname, "..", ".."),
  },
};

// Wrap with Sentry's build plugin. Source-map upload only happens when an auth
// token + org/project are present (set them at launch); without them the build
// stays green and simply skips upload — runtime reporting still works from the
// DSN. `silent` unless on CI keeps local builds quiet.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  // Proxy Sentry events through our own domain so ad-blockers don't drop
  // client-side errors. Excluded from the proxy.ts matcher.
  tunnelRoute: "/monitoring",
});
