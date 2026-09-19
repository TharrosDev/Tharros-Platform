import { z } from "zod";

import { capturePublicLead } from "@/lib/leads/capture";
import { leadCaptureRequesterKey } from "@/lib/leads/request";

export const runtime = "nodejs";

const PUBLIC_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store, max-age=0",
} as const;

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: PUBLIC_HEADERS });
}

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
    return Response.json({ error: "Invalid JSON body" }, { status: 400, headers: PUBLIC_HEADERS });
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid lead payload", issues: parsed.error.flatten().fieldErrors },
      { status: 400, headers: PUBLIC_HEADERS },
    );
  }

  const result = await capturePublicLead(
    token,
    {
      name: parsed.data.name,
      email: parsed.data.email?.trim() || null,
      phone: parsed.data.phone?.trim() || null,
      company: parsed.data.company?.trim() || null,
      message: parsed.data.message?.trim() || null,
    },
    leadCaptureRequesterKey(request.headers),
  );

  if (!result.ok) {
    if (result.reason === "rate_limited") {
      return Response.json({ error: "Capture form is receiving too many requests" }, { status: 429, headers: { ...PUBLIC_HEADERS, "Retry-After": "60" } });
    }
    return Response.json({ error: "Capture form not found" }, { status: 404, headers: PUBLIC_HEADERS });
  }

  return Response.json({ id: result.leadId, status: "captured" }, { status: 201, headers: PUBLIC_HEADERS });
}
