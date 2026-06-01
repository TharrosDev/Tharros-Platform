import { z } from "zod";

/**
 * Validation for the org onboarding + create-org forms. Shared by the client
 * form components (for typing) and the server actions (the authoritative check).
 * Mirrors the DB constraint on organizations.size.
 */

export const INDUSTRY_OPTIONS = [
  "Professional Services",
  "Trades & Construction",
  "Retail & E-commerce",
  "Food & Hospitality",
  "Health & Wellness",
  "Real Estate",
  "Technology",
  "Non-profit",
  "Other",
] as const;

export const SIZE_OPTIONS = [
  { value: "1", label: "Just me" },
  { value: "2-10", label: "2–10 people" },
  { value: "11-50", label: "11–50 people" },
  { value: "51-200", label: "51–200 people" },
  { value: "200+", label: "200+ people" },
] as const;

const SIZE_VALUES = SIZE_OPTIONS.map((o) => o.value) as [string, ...string[]];

export const orgNameSchema = z
  .string()
  .min(2, { error: "Enter your business name." })
  .max(80, { error: "Keep the name under 80 characters." })
  .trim();

export const industrySchema = z.enum(
  INDUSTRY_OPTIONS as unknown as [string, ...string[]],
  { error: "Choose an industry." },
);

export const sizeSchema = z.enum(SIZE_VALUES, { error: "Choose a team size." });

export const orgDetailsSchema = z.object({
  name: orgNameSchema,
  industry: industrySchema,
  size: sizeSchema,
});

/** Shape returned by every org server action on failure. */
export type OrgFormState =
  | {
      errors?: Record<string, string[] | undefined>;
      message?: string;
      values?: Record<string, string>;
    }
  | undefined;
