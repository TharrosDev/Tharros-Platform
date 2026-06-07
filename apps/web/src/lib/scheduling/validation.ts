/**
 * Day 50 — manual-edit constraint validation (pure, deterministic).
 *
 * The Day-49 candidate panel produces draft schedules that are correct by
 * construction. The moment a manager edits one by hand on the calendar, those
 * guarantees no longer hold — so every edit is re-validated against the full
 * constraint set and the resulting {@link EditViolation}s drive the UI (live,
 * client-side) AND gate the save (server-side, trust boundary).
 *
 * This layer composes four checks over a set of shifts:
 *   1. **Labor rules** — reuses the Day-42 {@link validateLaborRules} wholesale.
 *   2. **Double-booking** — one employee, two overlapping shifts (hard).
 *   3. **Availability** — an assigned shift outside the employee's Day-44
 *      whitelist availability, reusing the solver's {@link isAvailable} (hard).
 *   4. **Role qualification** — an assigned shift whose required role/cert the
 *      employee doesn't hold (hard).
 *
 * No I/O, no `server-only`: the server-only data layer assembles the
 * {@link ValidationContext} and the same function runs in the browser for
 * instant feedback. Time convention is the project-wide local-wall-clock-as-UTC.
 */

import { isAvailable } from "./solver/availability";
import { validateLaborRules } from "./labor-rules";
import type { LaborRules, ShiftInput, Violation } from "./types";
import type { PermanentRow, TemporaryRow } from "./queries";

/** Extra rule keys the edit validator emits on top of the labor-rule keys. */
export type EditRuleKey = "double_booking" | "availability_conflict" | "role_unqualified";

/** A {@link Violation} widened to also carry the edit-only rule keys. A labor
 * `Violation` is assignable here, so the two sets compose into one array. */
export type EditViolation = Omit<Violation, "rule"> & {
  rule: Violation["rule"] | EditRuleKey;
};

/** A shift under edit — a labor {@link ShiftInput} plus the role it must cover. */
export type EditShift = ShiftInput & {
  /** Required role/certification id, or null = any employee qualifies. */
  roleId: string | null;
};

/** The employee facts the edit checks depend on (a lighter `SolverEmployee`). */
export type ValidationEmployee = {
  id: string;
  isMinor: boolean;
  /** Role/cert ids the employee holds and that are valid for the period. */
  roleIds: string[];
  permanent: PermanentRow[];
  temporary: TemporaryRow[];
};

export type ValidationContext = {
  laborRules: LaborRules;
  employees: ValidationEmployee[];
};

function parseInstant(iso: string): number {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) throw new Error(`Invalid timestamp: ${iso}`);
  return ms;
}

/** Two windows overlap iff each starts before the other ends. */
function overlaps(a: EditShift, b: EditShift): boolean {
  return (
    parseInstant(a.startsAt) < parseInstant(b.endsAt) &&
    parseInstant(b.startsAt) < parseInstant(a.endsAt)
  );
}

/** Hard: an employee assigned to two shifts whose times overlap. */
export function validateNoDoubleBooking(shifts: EditShift[]): EditViolation[] {
  const byEmployee = new Map<string, EditShift[]>();
  for (const s of shifts) {
    if (s.employeeId === null) continue;
    const list = byEmployee.get(s.employeeId);
    if (list) list.push(s);
    else byEmployee.set(s.employeeId, [s]);
  }

  const violations: EditViolation[] = [];
  for (const [employeeId, list] of byEmployee) {
    const sorted = [...list].sort((a, b) => parseInstant(a.startsAt) - parseInstant(b.startsAt));
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      if (overlaps(prev, curr)) {
        violations.push({
          rule: "double_booking",
          severity: "hard",
          employeeId,
          shiftId: curr.id,
          message: "Assigned to two shifts that overlap in time.",
          details: { otherShiftId: prev.id },
        });
      }
    }
  }
  return violations;
}

/** Hard: an assigned shift falls outside the employee's declared availability. */
export function validateAvailability(
  shifts: EditShift[],
  employeesById: Map<string, ValidationEmployee>,
): EditViolation[] {
  const violations: EditViolation[] = [];
  for (const s of shifts) {
    if (s.employeeId === null) continue;
    const employee = employeesById.get(s.employeeId);
    if (!employee) continue;
    // Treat the shift as a single-head coverage slot for the whitelist check.
    const ok = isAvailable(employee, {
      id: s.id ?? "",
      date: s.startsAt.slice(0, 10),
      startsAt: s.startsAt,
      endsAt: s.endsAt,
      roleId: s.roleId,
      requiredStaff: 1,
      breakMinutes: s.breakMinutes,
    });
    if (!ok) {
      violations.push({
        rule: "availability_conflict",
        severity: "hard",
        employeeId: s.employeeId,
        shiftId: s.id,
        message: "Scheduled outside the times this person said they can work.",
      });
    }
  }
  return violations;
}

/** Hard: an assigned shift requires a role/cert the employee doesn't hold. */
export function validateRoleQualification(
  shifts: EditShift[],
  employeesById: Map<string, ValidationEmployee>,
): EditViolation[] {
  const violations: EditViolation[] = [];
  for (const s of shifts) {
    if (s.employeeId === null || s.roleId === null) continue;
    const employee = employeesById.get(s.employeeId);
    if (!employee) continue;
    if (!employee.roleIds.includes(s.roleId)) {
      violations.push({
        rule: "role_unqualified",
        severity: "hard",
        employeeId: s.employeeId,
        shiftId: s.id,
        message: "Not certified for the role this shift requires.",
        details: { roleId: s.roleId },
      });
    }
  }
  return violations;
}

/**
 * Run every edit check and aggregate the violations. The single entry point the
 * calendar UI and the calendar server actions both call.
 */
export function validateEdits(shifts: EditShift[], ctx: ValidationContext): EditViolation[] {
  const employeesById = new Map(ctx.employees.map((e) => [e.id, e]));
  const laborContext = ctx.employees.map((e) => ({ id: e.id, isMinor: e.isMinor }));
  return [
    ...validateLaborRules(shifts, ctx.laborRules, laborContext),
    ...validateNoDoubleBooking(shifts),
    ...validateAvailability(shifts, employeesById),
    ...validateRoleQualification(shifts, employeesById),
  ];
}
