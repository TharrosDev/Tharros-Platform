import { z } from "zod";

/**
 * Day 43 — scheduling onboarding wizard payload.
 *
 * The wizard is a client step-machine that serializes all steps into one hidden
 * `payload` field; the server action parses it with {@link schedulingSetupSchema}
 * (the authoritative check) before calling the `complete_scheduling_setup` RPC.
 * Labor params are resolved server-side from the Day-42 presets, so the client
 * only sends the chosen preset (+ custom overrides).
 */

const optionalNumber = z
  .union([z.number(), z.string()])
  .optional()
  .transform((v) => (v === undefined || v === "" ? undefined : Number(v)))
  .refine((v) => v === undefined || !Number.isNaN(v), { error: "Enter a number." });

export const employmentTypeSchema = z.enum(["full_time", "part_time", "casual", "contract"]);

export type EmploymentType = z.infer<typeof employmentTypeSchema>;

export const rosterEmployeeSchema = z.object({
  name: z.string().trim().min(1, { error: "Enter a name." }).max(120),
  email: z.email({ error: "Enter a valid email." }).trim().toLowerCase(),
  employment_type: employmentTypeSchema.default("part_time"),
  role: z.string().trim().max(80).optional(),
  seniority_rank: optionalNumber,
  is_minor: z.boolean().default(false),
  target_hours_weekly: optionalNumber,
  min_hours_weekly: optionalNumber,
  max_hours_weekly: optionalNumber,
});

const timeString = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, { error: "Use HH:MM." });

export const businessHoursDaySchema = z
  .object({
    day_of_week: z.number().int().min(0).max(6),
    opens_at: z.union([timeString, z.literal("")]).optional(),
    closes_at: z.union([timeString, z.literal("")]).optional(),
    is_closed: z.boolean().default(false),
  })
  .refine((d) => d.is_closed || (Boolean(d.opens_at) && Boolean(d.closes_at)), {
    error: "Set open and close times, or mark the day closed.",
    path: ["opens_at"],
  })
  .refine((d) => d.is_closed || !d.opens_at || !d.closes_at || d.closes_at > d.opens_at, {
    error: "Closing time must be after opening time.",
    path: ["closes_at"],
  });

export const staffingDaySchema = z.object({
  day_of_week: z.number().int().min(0).max(6),
  start_time: timeString,
  end_time: timeString,
  min_staff: z.number().int().min(0).max(999),
  role: z.string().trim().max(80).optional(),
});

export const laborSelectionSchema = z.object({
  preset: z.enum(["ontario", "canada_federal", "custom"]),
  // Only consulted when preset === "custom"; otherwise the server uses the preset.
  custom: z
    .object({
      max_daily_hours: optionalNumber,
      max_weekly_hours: optionalNumber,
      min_rest_hours_between_shifts: optionalNumber,
      overtime_threshold_weekly: optionalNumber,
      max_consecutive_days: optionalNumber,
    })
    .optional(),
});

export const personaSchema = z.object({
  tone: z.enum(["friendly", "professional", "casual", "direct"]).default("professional"),
  notes: z.string().trim().max(1000).optional().default(""),
});

export const schedulingSetupSchema = z.object({
  employees: z.array(rosterEmployeeSchema).max(500),
  businessHours: z.array(businessHoursDaySchema).length(7, {
    error: "Set hours for all seven days.",
  }),
  staffing: z.array(staffingDaySchema).max(7),
  labor: laborSelectionSchema,
  persona: personaSchema,
});

export type RosterEmployee = z.infer<typeof rosterEmployeeSchema>;
export type BusinessHoursDay = z.infer<typeof businessHoursDaySchema>;
export type StaffingDay = z.infer<typeof staffingDaySchema>;
export type LaborSelection = z.infer<typeof laborSelectionSchema>;
export type PersonaSelection = z.infer<typeof personaSchema>;
export type SchedulingSetupPayload = z.infer<typeof schedulingSetupSchema>;

/** Returned by the wizard server action. `message` (not `ok`) surfaces failures. */
export type SchedulingSetupState = { ok?: boolean; message?: string } | undefined;
