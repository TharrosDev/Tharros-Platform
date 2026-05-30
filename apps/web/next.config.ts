import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the Turbopack root to the monorepo so Next doesn't misinfer it from a
  // stray lockfile elsewhere on the machine.
  turbopack: {
    root: path.join(__dirname, "..", ".."),
  },
};

export default nextConfig;
