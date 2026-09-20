/**
 * Day 51 — pure publish-gate policy (no I/O, no `server-only`, client-importable).
 *
 * Kept out of `calendar-actions.ts` (which pulls in `server-only` via the admin
 * client and so throws under Vitest) so both the server action and the unit tests
 * can share it. The UI also imports it to mirror the gate before calling publish.
 */

import type { EditViolation } from "./validation";

/**
 * Whether a schedule may publish. A HARD violation always blocks (illegal — never
 * overridable). Open shifts (coverage gaps) and soft warnings require an explicit
 * manager `override` acknowledgement.
 */
export function publishGate(
  violations: EditViolation[],
  openShiftCount: number,
  override: boolean,
): { allowed: boolean; blockReason?: string } {
  const hard = violations.filter((v) => v.severity === "hard").length;
  if (hard > 0) {
    return {
      allowed: false,
      blockReason: `Fix ${hard} conflict${hard > 1 ? "s" : ""} before publishing.`,
    };
  }
  const soft = violations.filter((v) => v.severity === "soft").length;
  if ((openShiftCount > 0 || soft > 0) && !override) {
    const parts: string[] = [];
    if (openShiftCount > 0)
      parts.push(`${openShiftCount} open shift${openShiftCount > 1 ? "s" : ""}`);
    if (soft > 0) parts.push(`${soft} warning${soft > 1 ? "s" : ""}`);
    return { allowed: false, blockReason: `Confirm to publish with ${parts.join(" and ")}.` };
  }
  return { allowed: true };
}
