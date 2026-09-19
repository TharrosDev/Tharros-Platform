import "server-only";

import { createHash } from "node:crypto";

/**
 * Return a privacy-preserving, stable requester fingerprint for public lead
 * capture throttling. The raw address/user-agent never enters the rate-limit
 * table or application logs.
 */
export function leadCaptureRequesterKey(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ||
    headers.get("x-real-ip")?.trim() ||
    headers.get("cf-connecting-ip")?.trim() ||
    "unknown";
  const userAgent = headers.get("user-agent")?.trim().slice(0, 256) || "unknown";

  return createHash("sha256")
    .update(`${ip}\n${userAgent}`)
    .digest("hex")
    .slice(0, 32);
}
