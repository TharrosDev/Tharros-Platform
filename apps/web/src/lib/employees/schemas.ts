import { z } from "zod";

/**
 * Validation for the add-employee form. Shared by the client form (typing) and
 * the server action (the authoritative check). Employees are account-less roster
 * identities — name + email is all Day 37 needs; the scheduling columns arrive
 * in Day 41.
 */

export const employeeNameSchema = z
  .string()
  .trim()
  .min(1, { error: "Enter the employee's name." })
  .max(120, { error: "Name is too long." });

export const employeeEmailSchema = z
  .email({ error: "Enter a valid email address." })
  .trim()
  .toLowerCase();

export const employeeSchema = z.object({
  name: employeeNameSchema,
  email: employeeEmailSchema,
});

/** Shape returned by the add-employee server action. `ok` drives the success toast. */
export type EmployeeFormState =
  | {
      ok?: boolean;
      errors?: Record<string, string[] | undefined>;
      message?: string;
      values?: Record<string, string>;
    }
  | undefined;
