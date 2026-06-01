# Day 11 — Row-Level Security Design

**Date:** 2026-05-31
**Status:** Implemented
**Phase:** 1 (Auth, Multi-Tenancy & Billing), Tharros Platform launch roadmap

## Problem

Day 10 created the tenant schema — `profiles`, `organizations`, `memberships` — with
RLS **enabled but no policies**, i.e. deny-all. The app reads and writes through the
user's session (publishable key), so until policies exist the authed app can see
nothing. Day 11 writes the policies that make the app usable while guaranteeing one
tenant can never read or modify another's data. This is the highest-risk security task
in the roadmap and a launch gate (re-verified Day 79).

## Goals

- Org-scoped isolation on every tenant table: you only ever see rows in orgs you belong to.
- A complete, role-aware write model so Day 13 (team management) is UI-only.
- A durable, repeatable test harness proving cross-tenant isolation and the role rules.

## Non-goals

- User-initiated org creation (no INSERT policy on `organizations`) — the signup trigger
  stays the sole creator; multi-org creation is a Day 12 onboarding RPC.
- Any app/UI feature code. Day 11 is the data-access layer only.

## Decisions

1. **Test harness = Vitest integration test** with two real users, seeded via the
   service-role key and exercised through user-session clients. Repeatable with
   `pnpm test`; re-run on Day 79.
2. **Full role-aware policies now** (not just minimal read isolation).
3. **No user INSERT on `organizations`** — deferred to Day 12.
4. **Owners-only role changes** — admins add/remove plain members but cannot change any
   role or touch owner/admin rows.

## Role model

- **owner** — full control of the org: rename/delete the org, add/remove anyone, change
  any role. An org must always have ≥1 owner.
- **admin** — add plain members, remove plain members. Cannot change roles, cannot touch
  owner/admin rows, cannot rename/delete the org.
- **member** — read-only within the org; may remove themselves (leave).

## Architecture

One migration (`supabase/migrations/20260531200000_rls_policies.sql`, repo source of
truth, applied to the live DB via Supabase MCP `execute_sql` per project convention) plus
a Vitest harness. Builds on the Day-10 `current_user_orgs()` SECURITY DEFINER helper and
adds a `current_user_role(uuid)` helper. Both are SECURITY DEFINER so policy evaluation
doesn't recurse into the very table being protected; EXECUTE is revoked from `anon`/`public`
(kept for `authenticated`, which the advisor flags — intentional and required).

### Policies (9)

**profiles** — `select` self OR co-member (shares an org); `update` self only.
**organizations** — `select` member; `update`/`delete` owner. No INSERT.
**memberships** — `select` co-member; `insert` owner/admin AND `role = 'member'`;
`update` owner only; `delete` owner OR (admin AND target is member) OR self-leave.

### Invariant guard trigger

`enforce_membership_invariants()` (`before update or delete on memberships`,
SECURITY DEFINER) blocks removing or demoting the **last owner** of an org — an invariant
RLS expresses poorly. **Critical subtlety:** deleting an organization cascades to its
memberships, which would trip this guard and make org deletion impossible. The guard
therefore skips when the parent org row no longer exists
(`exists (select 1 from organizations where id = v_org)`), so a cascade from an org delete
passes. Trigger-only function: EXECUTE revoked from all roles.

## Test harness

`apps/web/src/lib/supabase/__tests__/rls.test.ts` (Vitest, node env, loads `.env.local`
via dotenv). An admin (service-role) client seeds User A (org A), User B (org B), and
User C as a member of org A, then signs in user-session clients to exercise the live
policies — exactly the app's path. Coverage:

- Isolation: A sees only org A, B only org B; cross-tenant SELECT returns `[]`.
- profiles: A sees self + co-member C, never B; A edits own profile, not B's.
- org writes: owner renames; member/outsider cannot; **owner can delete own org**
  (regression for the cascade-vs-guard bug).
- membership writes: member cannot add or change roles; owner promotes to admin; a
  promoted admin still cannot change roles; **last owner cannot be demoted or removed**;
  a member can leave.

`afterAll` deletes the seeded users (cascades) and their orgs.

## Verification

- `pnpm --filter @tharros/web test` → 14 passing.
- `get_advisors(security)` → no `rls_enabled_no_policy`; only the two intentional
  `current_user_*` definer-function WARNs + the pre-existing leaked-password WARN.
- `pnpm typecheck` / `lint` green; live DB returns to 1 user / 1 org after the run.

## Test-infrastructure note

This adds the project's first test runner (Vitest + dotenv). `esbuild` (a vitest dep)
trips pnpm 11's build-script gate; it ships its binary via the `@esbuild/win32-x64`
optional dep, so its postinstall isn't required — but `pnpm <script>` aborts on
`ERR_PNPM_IGNORED_BUILDS` until the package is acknowledged. Resolved by allow-listing
`esbuild: true` in `pnpm-workspace.yaml` and reinstalling so the gate clears.
