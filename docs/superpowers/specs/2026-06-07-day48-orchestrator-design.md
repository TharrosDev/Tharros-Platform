# Day 48 — Agent Orchestrator + Optimize-Loop (design)

**Date:** 2026-06-07
**Phase:** 3 (AI Workforce Scheduling), section 3D
**Status:** approved design, pre-implementation
**Roadmap line:** "Agent orchestrator + optimize-loop. ⚠️ Core IP. The orchestrator
calls the solver as a tool, reads the gap report, and **iterates** — relax a soft
constraint / request more availability via the portal / propose OT to the manager →
re-run — until coverage is met or it escalates. Every step audit-logged."

## Decisions (locked with the user)

1. **Loop architecture: hybrid.** A deterministic TS controller owns the loop
   (solve → read gaps → apply the remedy ladder → re-solve → terminate). An LLM
   (DeepSeek v4-pro) is consulted only at genuine judgment points and is injected
   so committed tests stay provider-free.
2. **Escalations are emitted, not fired.** When autonomous remedies are exhausted,
   the loop returns structured escalation objects (with advisor-drafted copy). It
   does NOT send notifications or create portal requests — delivery is Days 50–54.
3. **Persist the trail now via the Day-39 rails.** The run happens on an
   `ai_conversation_threads` thread (`kind='schedule_opt'`) and every step is
   written to `agent_audit_log` via `recordAuditEvent`. No new migration:
   `kind`/`action` are free-text and `AgentAuditAction` is `… | (string & {})`.
4. **Conservative remedy ladder.** Autonomous moves only relax orchestrator-imposed
   soft constraints and push hours to the *legal* labor ceiling, then escalate.
   The loop never silently trades away fairness/seniority/performance.

## What this day is (and is not)

A **no-new-migration orchestration day**, like Days 46/47 — but unlike them it
*writes to existing Day-39 tables* (threads + audit log). It produces a schedule
**preview** plus an iteration trace and escalations; it does **not** persist a
draft schedule (that is Day 49) and ships **no UI** (dashboard is Days 50–51).

## Architecture

New code under `apps/web/src/lib/scheduling/orchestrator/`:

- **`types.ts`** — pure domain types: `OptimizeInput`, `RemedyKind`, `RemedyStep`,
  `EscalationKind`, `Escalation`, `OptimizeTrace`, `OptimizeResult`. No
  `server-only` (so the loop, ladder, and tests import freely).
- **`remedies.ts`** — pure, deterministic remedy ladder + termination logic.
  `nextRemedy(gapReport, appliedSoFar, input) → Remedy | null` and the pure
  `applyRemedy(input, remedy) → OptimizeInput`. Fully fixture-tested.
- **`orchestrate.ts`** — the pure hybrid loop `runOptimizeLoop(args)`. All side
  effects injected via an `OptimizeIO` seam (mirrors `agents/turn-loop.ts`):
  `solve()`, `audit()`, `advise*()` (LLM), `createThread()`/`touchThread()`.
  Unit-testable with fakes; deterministic given a stubbed advisor.
- **`advisor.ts`** — the injected LLM seam (DeepSeek v4-pro, `SCHEDULING_MODEL_PRO`).
  Two pure, provider-free helpers (injected `chat`, like `intent.ts`):
  `adviseDirectiveNudges()` — map non-solver-expressible directives to soft nudges
  or flag-for-escalation; `draftEscalationMessage()` — plain-language copy for an
  escalation. Metered via injected `onUsage`.
- **`orchestrate-handler.ts`** — `server-only` wiring: real solver
  (`buildSolverInput` + `solveSchedule`), `recordAuditEvent`, `createThread`,
  DeepSeek `chatCompletion`, `recordUsage`. The agent is a SYSTEM actor → admin
  client for thread/audit writes; tenancy scoped in code by `orgId`.
- **`orchestrate-actions.ts`** — `"use server"`, manager-gated, returns a PREVIEW
  (`OptimizeResult`), not saved. Mirrors `runStaffingForecast` /
  `translateSchedulingIntent` (resolve org + user, meter usage, scope by RLS).

## The optimize-loop (core IP)

The deterministic controller owns control flow; the LLM is consulted only for
judgment.

1. **Assemble baseline inputs.** Day-47 forecast `staffing_requirements` + intent
   `weights` + `employeeAdjustments`; translate solver-expressible `directives`
   into soft nudges directly. Non-expressible directives → `adviseDirectiveNudges`
   (LLM) to become soft nudges, else marked for escalation.
2. **Solve** via `solve_schedule` → read `gapReport`.
3. **Coverage met?** (no entry with `missing > 0`) → done.
4. Else pick the **next remedy** from the deterministic ladder. If one exists →
   `applyRemedy` (re-tune inputs) → re-solve → loop. Bounded by `MAX_ROUNDS`
   (default 6) as a runaway backstop.
5. **No autonomous remedy left** → emit a structured escalation for the residual
   gaps and terminate.

### Remedy ladder (conservative, autonomous, in order)

All moves are solver-expressible and keep the solver correct-by-construction
(hard rules are never relaxed):

1. Relax orchestrator-imposed **directive-derived soft penalties**.
2. **`laborSoft → 0`** (allow soft overtime / more consecutive days — still legal).
3. Raise individual **`maxHoursWeekly` toward the labor hard ceiling** (soft OT).

When the ladder is exhausted and gaps remain, the gap is genuinely a human
decision → escalate. The loop deliberately does **not** auto-lower
fairness/seniority/performance weights (rejected "aggressive" option) — that would
silently trade schedule quality.

### Escalations (emitted, not fired)

- **`propose_overtime`** — residual gap fillable only by exceeding comfort hours:
  `{ slotId, date, candidateEmployeeIds[], draftMessage }`.
- **`request_availability`** — gap from nobody available: `{ employeeIds[],
  period, note }`.
- **`manager_decision`** — structurally infeasible (no qualified staff exists at
  all for the role): `{ slotId, reason }`.

Day-49 persists these; Days 50–54 deliver them (Day-40 notifications / Day-45
portal availability).

### Audit trail

Each step is `recordAuditEvent` on the `kind='schedule_opt'` thread with actor
`system` (deterministic control) or `ai` (advisor calls):
`optimize_started`, `solve_attempt` (with score + gap counts), `remedy_applied`
(with remedy kind + before/after gap counts), `model_call` (advisor, with usage),
`escalation_emitted`, `optimize_completed`.

## Determinism & the LLM boundary

The loop's **control flow and termination are 100% deterministic**: given the same
solver inputs and a stubbed advisor, the trace is byte-identical. The advisor
(DeepSeek) is consulted only to (a) map fuzzy / non-expressible directives to soft
nudges and (b) draft human-readable escalation copy. **Neither can change whether
coverage is met** — only which soft nudge is tried and how a gap is explained. This
preserves "correct by construction" and lets committed tests stay provider-free
(faked advisor + faked solver/audit IO).

## Return shape (consumed by Day 49)

```ts
type OptimizeResult = {
  threadId: string;
  schedule: { assignments: Assignment[]; shifts: ShiftInput[] }; // final solve
  gapReport: GapReportEntry[];   // residual after the loop
  covered: boolean;
  trace: RemedyStep[];           // ordered solve→remedy→solve, score + gap deltas
  escalations: Escalation[];
  summary: string;               // advisor-drafted plain-language recap
};
```

Day 49 persists `schedule` as a draft + versions and the `trace` / `gapReport` /
`escalations` as the durable record; Days 50–54 deliver escalations.

## Testing

- **Pure fixture (Vitest, provider-free):** ladder ordering; termination (covered
  vs ladder-exhausted); trace correctness; escalation selection per gap reason;
  directive handling with a faked advisor; `MAX_ROUNDS` backstop. Uses a fake
  solver returning scripted gap reports — no DeepSeek, no DB.
- **`.db.test.ts` (CI Supabase test project):** run the handler; assert a
  `schedule_opt` thread and the expected `agent_audit_log` rows are written
  (mirrors `agent-audit.db.test.ts`). Provider-free (advisor stubbed or the no-LLM
  path exercised).
- Run `pnpm lint` **after** all files exist (the Day-39 unused-symbol-in-CI gotcha).
- Gate: `typecheck · lint · test · build` green; CI may hit the known
  `claim_due_jobs` flake — a `--failed` rerun is expected to pass.

## Out of scope (later days)

- Persisting the draft schedule + versions (Day 49).
- Candidate panel + judge / parallel objective weightings (Day 49).
- Delivering escalations — notifications / portal requests (Days 50–54).
- Manager dashboard, manual edits, approval/publish (Days 50–51).

## Files touched

- New: `apps/web/src/lib/scheduling/orchestrator/{types,remedies,orchestrate,advisor,orchestrate-handler,orchestrate-actions}.ts`
- New tests: `apps/web/src/lib/scheduling/orchestrator/__tests__/{remedies,orchestrate}.test.ts` + `apps/web/src/lib/scheduling/__tests__/orchestrator.db.test.ts`
- No migration. No UI. Possibly extend `AgentAuditAction` union in
  `apps/web/src/lib/agents/types.ts` with the new action names (additive,
  back-compat via `(string & {})`).
