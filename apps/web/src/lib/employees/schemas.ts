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

/* ---------------------------------------------------------------------------
 * Day 52 — employee profile + role-certification management.
 * ------------------------------------------------------------------------- */

/** Empty string / null / undefined → undefined; else coerce to a finite number. */
const optionalNumber = z
  .union([z.number(), z.string(), z.null()])
  .optional()
  .transform((v) => (v === undefined || v === null || v === "" ? undefined : Number(v)))
  .refine((v) => v === undefined || Number.isFinite(v), { error: "Enter a number." });

const optionalDate = z
  .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Use a valid date." }), z.literal("")])
  .optional();

export const employmentTypeSchema = z.enum(["full_time", "part_time", "casual", "contract"]);

/** The editable profile fields (name/email are managed via the add flow + identity). */
export const employeeProfileSchema = z.object({
  employment_type: employmentTypeSchema.default("part_time"),
  phone: z.string().trim().max(40).optional(),
  seniority_rank: optionalNumber.refine((v) => v === undefined || (v >= 0 && v <= 100000), {
    error: "Seniority looks out of range.",
  }),
  hire_date: optionalDate,
  is_minor: z.boolean().default(false),
  target_hours_weekly: optionalNumber.refine((v) => v === undefined || (v >= 0 && v <= 168), {
    error: "Hours must be between 0 and 168.",
  }),
  min_hours_weekly: optionalNumber.refine((v) => v === undefined || (v >= 0 && v <= 168), {
    error: "Hours must be between 0 and 168.",
  }),
  max_hours_weekly: optionalNumber.refine((v) => v === undefined || (v >= 0 && v <= 168), {
    error: "Hours must be between 0 and 168.",
  }),
  performance_score: optionalNumber.refine((v) => v === undefined || (v >= 0 && v <= 100), {
    error: "Score must be between 0 and 100.",
  }),
  notes: z.string().trim().max(2000).optional(),
});

export type EmployeeProfileInput = z.infer<typeof employeeProfileSchema>;

/** Create a new role/certification in the org catalog. */
export const roleCertificationSchema = z.object({
  name: z.string().trim().min(1, { error: "Enter a name." }).max(80),
  kind: z.enum(["role", "certification"]).default("role"),
  description: z.string().trim().max(300).optional(),
});

export type RoleCertificationInput = z.infer<typeof roleCertificationSchema>;

/** Assign a catalog role/cert to an employee, with an optional expiry. */
export const roleAssignmentSchema = z.object({
  employeeId: z.uuid({ error: "Missing employee." }),
  roleCertificationId: z.uuid({ error: "Pick a role." }),
  expiresAt: optionalDate,
});

export type RoleAssignmentInput = z.infer<typeof roleAssignmentSchema>;

/** Returned by the profile/role server actions. */
export type ProfileActionResult = { ok: true } | { ok: false; message: string };
