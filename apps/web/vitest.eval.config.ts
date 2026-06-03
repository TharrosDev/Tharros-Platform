import { fileURLToPath } from "node:url";

import { config } from "dotenv";
import { defineConfig } from "vitest/config";

// Day 34 — dedicated config for the gated RAG eval harness (`*.live.ts`). Run on
// demand via `pnpm eval`; NOT part of the default `vitest run` (the base config
// excludes `**/*.live.ts`). Needs OPENAI_API_KEY + ANTHROPIC_API_KEY from
// .env.local; the harness self-skips when they're absent.
config({ path: ".env.local" });

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/eval/**/*.live.ts"],
    // Many live OpenAI + Anthropic round-trips across a config sweep.
    testTimeout: 900_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
