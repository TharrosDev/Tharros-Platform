"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { capturePublicLead } from "@/lib/leads/capture";
import { logger } from "@/lib/observability/logger";

const optional = (max: number) =>
  z.preprocess(
    (value) => {
      const text = String(value ?? "").trim();
      return text.length ? text : null;
    },
    z.string().max(max).nullable(),
  );

const schema = z
  .object({
    name: z.string().trim().min(1).max(160),
    email: optional(320),
    phone: optional(80),
    company: optional(160),
    message: optional(4000),
  })
  .refine((value) => value.email || value.phone || value.message, {
    message: "Provide at least one way to contact you or a message.",
  });

export async function submitPublicLead(token: string, formData: FormData): Promise<void> {
  const safeToken = encodeURIComponent(token);

  if (String(formData.get("website") ?? "").trim()) {
    redirect(`/forms/${safeToken}?submitted=1`);
  }

  const parsed = schema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    company: formData.get("company"),
    message: formData.get("message"),
  });
  if (!parsed.success) redirect(`/forms/${safeToken}?error=invalid`);

  try {
    const result = await capturePublicLead(token, parsed.data);
    if (!result.ok) {
      redirect(
        `/forms/${safeToken}?error=${result.reason === "rate_limited" ? "busy" : "invalid-form"}`,
      );
    }
  } catch (err) {
    logger.error("leads.public_submit_failed", { err });
    redirect(`/forms/${safeToken}?error=submit`);
  }

  redirect(`/forms/${safeToken}?submitted=1`);
}
