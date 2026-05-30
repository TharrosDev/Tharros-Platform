import path from "node:path";
import type { NextConfig } from "next";

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

export default nextConfig;
