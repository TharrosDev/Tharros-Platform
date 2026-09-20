# Day 49 — Candidate Panel + Judge (quality swarm) + Persistence (design)

**Date:** 2026-06-07
**Phase:** 3 (AI Workforce Scheduling), §3D · Core IP
**Status:** approved design, implemented
**Roadmap line:** "Candidate panel + judge (quality swarm). Run the solver in
parallel under several objective weightings (fairness / seniority / cost) →
hard-constraint filter (every candidate is guaranteed-legal) → a judge agent scores
them on the soft/human criteria, picks the best, and explains the trade-off in plain
language. Persist draft + versions + gap report + full agent/solver audit trail."

## Decisions (locked with the user)

1. **Candidate engine = the Day-48 optimize-loop per weighting**, run with
   `useLlm:false` so candidate generation is fully deterministic + cheap. The judge
   is the only LLM call.
2. **Panel = 4 weighting profiles**: `balanced` (defaults), `fairness` (fairness↑),
   `seniority` (seniority↑), `cost` (laborSoft↑, hourTarget↓ — overtime-avoidance
   proxy; there is no wage data).
3. **Judge = a single holistic DeepSeek `v4-pro` call** ranking all candidates,
   picking the winner, and explaining the trade-off; deterministic fallback +
   tie-break (least `totalMissing` → lowest solver score → profile order).
4. **Versions = a first-class `schedule_versions` table** + the winner written as
   `schedules`(draft)+`shifts`. One migration, applied to prod + CI test.

## What this day is (and is not)

The first writer of the Day-41 `schedules`/`shifts` tables. It produces a persisted
**draft** schedule + all candidate versions + the judge's rationale + an audit
trail, and returns a `PanelResult`. It ships **no UI** (Day 50–51 dashboard), and
**nothing is published** (Day 51).

## Architecture

New code under `apps/web/src/lib/scheduling/panel/`:

- **`profiles.ts`** — pure: the 4 `SolverWeights` profiles + labels (`CANDIDATE_PROFILES`).
- **`types.ts`** — `Candidate`, `CandidateMetrics`, `JudgeVerdict`, `RankedCandidate`,
  `PanelOutcome`, `CandidateSummary`, `PanelResult`.
- **`metrics.ts`** — pure `candidateMetrics(result, roster, overtimeThreshold)`:
  coverage/totalMissing, final solver score (from the loop trace), total hours,
  fairness (per-employee hours std-dev across the roster), overtime hours (over the
  weekly threshold), hours-weighted mean seniority rank, escalation count. Uses the
  Day-42 `shiftHours`.
- **`judge.ts`** — `judgeCandidates(candidates, deps)`: one DeepSeek call
  (`generateStructuredDeepSeek`, `SCHEDULING_MODEL_PRO`) → `{winnerLabel, ranking,
rationale}`. Pure + provider-free (injected `chat`). Sanitizes the ranking to the
  provided labels and **falls back to a deterministic ranking** on any model issue;
  short-circuits (no call) for a single candidate.
- **`panel.ts`** — pure `runCandidatePanel(candidates, {metricsOf, judge})`:
  hard-constraint filter (drop candidates with hard `Violation`s — expected none),
  judge the legal pool, mark `judgeRank`/`isSelected` on every candidate.
- **`panel-handler.ts`** — `server-only`: fetch roster + labor rules; run
  `optimizeSchedule({weights: profile, useLlm:false})` per profile; self-check each
  candidate with `validateLaborRules`; `runCandidatePanel` with the DeepSeek judge;
  persist.
- **`panel-actions.ts`** — `"use server"` `runSchedulePanel({periodStart, periodEnd,
agentInputs?})`, owner/admin gated (explicit role check).

## The flow

1. For each of the 4 profiles → `optimizeSchedule` deterministically (`useLlm:false`).
   Each candidate is a fully-optimized, escalation-aware `OptimizeResult`; each loop
   still writes its own trail to `agent_audit_log` (Day 48).
2. **Hard filter** — `validateLaborRules` over each candidate's assigned shifts; drop
   any with a hard violation (safety net; the solver is correct-by-construction).
3. **Metrics** — derive the comparable stats per candidate (pure).
4. **Judge** — one DeepSeek call ranks all candidates, picks the winner, explains.
   Tie/failure → deterministic fallback.
5. **Persist** the winner + all versions (below).

## Persistence (the migration)

`supabase/migrations/20260614120000_schedule_versions.sql`, applied via Supabase MCP
`execute_sql` to prod (`inxhrijqyxvwoeqczbrl`) + CI test (`psunqcyzjcmfgcrnowdl`):

- `schedules` (existing): the winner is inserted as `status='draft'`, `created_by`,
  plus a new **`optimization_summary text`** column (the judge's rationale).
- `shifts` (existing): the winner's assignments (open shifts kept, `employee_id null`
  → `status='open'`; assigned → `status='draft'`).
- **`schedule_versions`** (new): one row per candidate — `id, org_id, schedule_id→
schedules (cascade), label, weights jsonb, assignments jsonb, score jsonb (the
metrics), gap_report jsonb, covered, total_missing, judge_rank, is_selected, note,
created_at`. Indexes on `org_id`, `schedule_id`. RLS **member-read / manager-write**,
  mirroring the Day-41 policy loop.

**Client posture (mirrors Day 48):** schedules/shifts/versions write through the
user-session manager client (RLS manager-write gates them); the
`scheduling_audit_log` rows (`schedule.created`, `candidate_panel.judged`) write
through the service-role admin client (that table is service-role/RPC-write only).

## Determinism & LLM boundary

Candidate generation is 100% deterministic (no LLM). The **only** LLM call is the
judge, and it has a deterministic fallback, so the pipeline always selects a winner
and committed tests stay provider-free. The judge orders a fixed, legal candidate
set — it can't widen the choice or change a candidate's legality.

## Return shape (`PanelResult`)

```ts
{
  scheduleId: string | null;        // persisted draft
  selectedLabel: CandidateLabel;
  selected: OptimizeResult;         // winner (schedule + residual gaps + escalations)
  versions: CandidateSummary[];     // all 4: label, metrics, covered, judgeRank, isSelected
  judge: { winnerLabel, ranking, rationale };
  summary: string;                  // judge rationale (also on schedules.optimization_summary)
}
```

## Testing

- **Pure (provider-free):** `metrics.test.ts` (stat derivation), `panel.test.ts`
  (hard-filter excludes illegal candidates, judge selection honored, metrics for all,
  empty guard), `judge.test.ts` (faked DeepSeek `chat`: happy path, ranking
  sanitation, fallback on bad winner / model throw, single-candidate short-circuit).
- **`schedule-persistence.db.test.ts`** (CI Supabase project): manager writes a draft
  schedule (+ `optimization_summary`), shifts, and versions; member reads versions but
  can't write; outsider sees none. Provider-free.
- Gates: `typecheck · lint · test · build` green. Known `claim_due_jobs` CI flake may
  need a `--failed` rerun.

## Out of scope (later days)

Manager dashboard / calendar / manual edits + live re-validation (Day 50); approval &
**publish** flow + version UI (Day 51); delivering Day-48 escalations (Days 50–54).
