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

/**
 * Notification preferences (Day 21). Stored as a flat boolean map in
 * org_settings.notifications (jsonb). Forward-looking: the consumers (lead
 * alerts, the weekly summary) land in later phases; billing/account emails are
 * the only ones with a sender today. Keep the keys in sync with the DB shape.
 */
export const NOTIFICATION_OPTIONS = [
  {
    key: "new_lead",
    label: "New lead alerts",
    hint: "Email the team when Lead Capture records a new lead.",
  },
  {
    key: "weekly_summary",
    label: "Weekly summary",
    hint: "A Monday digest of activity across your workspace.",
  },
  {
    key: "billing_account",
    label: "Billing & account emails",
    hint: "Receipts, renewal reminders, and important account notices.",
  },
] as const;

export type NotificationKey = (typeof NOTIFICATION_OPTIONS)[number]["key"];

/** A complete preferences map. Every key is present and boolean. */
export const notificationsSchema = z.object(
  Object.fromEntries(
    NOTIFICATION_OPTIONS.map((o) => [o.key, z.boolean()]),
  ) as Record<NotificationKey, z.ZodBoolean>,
);

export type Notifications = z.infer<typeof notificationsSchema>;

/** Defaults applied when an org_settings.notifications jsonb is empty/partial. */
export const NOTIFICATION_DEFAULTS: Notifications = {
  new_lead: true,
  weekly_summary: true,
  billing_account: true,
};

/** Merge a stored (possibly partial) jsonb map onto the defaults. */
export function resolveNotifications(stored: unknown): Notifications {
  const base = { ...NOTIFICATION_DEFAULTS };
  if (stored && typeof stored === "object") {
    for (const { key } of NOTIFICATION_OPTIONS) {
      const v = (stored as Record<string, unknown>)[key];
      if (typeof v === "boolean") base[key] = v;
    }
  }
  return base;
}

/** Shape returned by every org server action on failure. */
export type OrgFormState =
  | {
      ok?: boolean;
      errors?: Record<string, string[] | undefined>;
      message?: string;
      values?: Record<string, string>;
    }
  | undefined;
