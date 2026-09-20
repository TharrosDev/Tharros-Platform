import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { PRIVATE_PATHS, PUBLIC_PATHS } from "../robots";

/*
  The deny list used to be maintained by hand and had drifted: /leads,
  /automations and /forms were all servable and absent from it. This walks the
  route tree instead of trusting the list, so the next route that is added
  without a decision fails here rather than quietly becoming indexable.
*/
const APP_DIR = join(import.meta.dirname, "..");

/** Top-level URL segments the router actually serves. */
function topLevelRoutes(): string[] {
  const out = new Set<string>();

  const walk = (dir: string, prefix: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith("_") || entry.name === "__tests__") continue;

      // Route groups like (marketing) are invisible in the URL.
      if (entry.name.startsWith("(") && entry.name.endsWith(")")) {
        walk(join(dir, entry.name), prefix);
        continue;
      }
      // Dynamic segments belong to their parent, which is already recorded.
      if (entry.name.startsWith("[")) continue;

      if (prefix === "") out.add(`/${entry.name}`);
    }
  };

  walk(APP_DIR, "");
  return [...out].sort();
}

const covered = (route: string) =>
  PUBLIC_PATHS.includes(route) ||
  PRIVATE_PATHS.some((p) => route === p || route === p.replace(/\/$/, ""));

describe("robots", () => {
  it("accounts for every top-level route", () => {
    const missing = topLevelRoutes().filter((route) => !covered(route));
    expect(missing, `routes missing from robots.ts: ${missing.join(", ")}`).toEqual([]);
  });

  it("keeps the public and private lists disjoint", () => {
    const overlap = PUBLIC_PATHS.filter((p) => PRIVATE_PATHS.includes(p));
    expect(overlap).toEqual([]);
  });

  it("indexes only the marketing surfaces", () => {
    expect(PUBLIC_PATHS).toEqual(["/", "/pricing", "/privacy", "/terms", "/security"]);
  });
});
