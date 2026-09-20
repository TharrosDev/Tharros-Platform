import { describe, expect, it } from "vitest";

import { soleOwnedOrgIds } from "@/lib/account/owned-orgs";

/**
 * Day 21 — pure unit tests for the account-deletion sole-owner detection. No
 * Supabase/Stripe; this is the decision the deleteAccount action delegates to.
 */
describe("soleOwnedOrgIds", () => {
  it("returns orgs the user is the only owner of", () => {
    expect(soleOwnedOrgIds(["o1", "o2"], { o1: 1, o2: 1 })).toEqual(["o1", "o2"]);
  });

  it("excludes orgs with other owners", () => {
    expect(soleOwnedOrgIds(["o1", "o2"], { o1: 1, o2: 3 })).toEqual(["o1"]);
  });

  it("treats a missing count as sole-owned (defensive: org with no visible co-owner)", () => {
    expect(soleOwnedOrgIds(["o1"], {})).toEqual(["o1"]);
  });

  it("returns nothing when the user owns nothing", () => {
    expect(soleOwnedOrgIds([], { o1: 1 })).toEqual([]);
  });
});
