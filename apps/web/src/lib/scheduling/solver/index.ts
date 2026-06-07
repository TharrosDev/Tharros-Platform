/**
 * Day 46 — deterministic scheduling solver: public (pure) surface.
 *
 * Re-exports the pure engine, scoring, availability, and input-assembly so
 * callers and tests have one import. The server-only pieces (`build-input`,
 * `tool`) are intentionally NOT re-exported here — import them directly from
 * their modules so this barrel stays safe to import under Vitest.
 */

export * from "./types";
export { solveSchedule, expandHeads, greedyAssign, localSearch, buildEligibility } from "./solver";
export { scoreSolution, allShifts, filledShifts, toAssignments } from "./score";
export { isAvailable } from "./availability";
export { assembleSolverInput } from "./assemble-input";
export type {
  AssembleSolverInputArgs,
  RawEmployee,
  RawRoleAssignment,
  RawAvailability,
  RawBusinessHours,
  RawStaffing,
} from "./assemble-input";
