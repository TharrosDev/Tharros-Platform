import { z } from "zod";

import { capturePublicLead } from "@/lib/leads/capture";

export const runtime = "nodejs";

const optional = (max: number) => z.string().trim().max(max).nullable().optional();

const schema = z
  .object({
    name: z.string().trim().min(1).max(160),
    email: optional(320),
    phone: optional(80),
    company: optional(160),
    message: optional(4000),
  })
  .refine((value) => value.email || value.phone || value.message, {
    message: "email, phone, or message is required",
  });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<Response> {
  const { token } = await params;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid lead payload", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const result = await capturePublicLead(token, {
    name: parsed.data.name,
    email: parsed.data.email?.trim() || null,
    phone: parsed.data.phone?.trim() || null,
    company: parsed.data.company?.trim() || null,
    message: parsed.data.message?.trim() || null,
  });

  if (!result.ok) {
    if (result.reason === "rate_limited") {
      return Response.json({ error: "Capture form is receiving too many requests" }, { status: 429 });
    }
    return Response.json({ error: "Capture form not found" }, { status: 404 });
  }

  return Response.json({ id: result.leadId, status: "captured" }, { status: 201 });
}
