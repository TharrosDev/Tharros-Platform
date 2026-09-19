import { createHash } from "node:crypto";

export type HeaderReader = Pick<Headers, "get">;

export function opaqueRateLimitKey(namespace: string, ...parts: string[]): string {
  const digest = createHash("sha256")
    .update(parts.join("\n"))
    .digest("hex")
    .slice(0, 32);
  return `${namespace}:${digest}`;
}

/**
 * Privacy-preserving requester key for abuse controls. Raw network metadata is
 * never persisted in the rate-limit table.
 */
export function requestFingerprint(headers: HeaderReader): string {
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

/**
 * Route-handler CSRF guard for authenticated mutation endpoints.
 *
 * Modern browsers provide Sec-Fetch-Site. If it is unavailable, require an
 * exact same-origin Origin or Referer. This is defense-in-depth beside
 * SameSite cookies and framework protections.
 */
export function isSameOriginMutation(request: Request): boolean {
  const fetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();
  if (fetchSite) {
    if (fetchSite === "same-origin") return true;
    if (fetchSite === "cross-site" || fetchSite === "same-site" || fetchSite === "none") {
      return false;
    }
  }

  const expectedOrigin = new URL(request.url).origin;

  const origin = request.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).origin === expectedOrigin;
    } catch {
      return false;
    }
  }

  const referer = request.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).origin === expectedOrigin;
    } catch {
      return false;
    }
  }

  return false;
}


export type JsonBodyResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: "too_large" | "invalid_json" };

/** Read a small JSON request body with an explicit byte ceiling. */
export async function readJsonBody<T>(
  request: Request,
  maxBytes: number,
): Promise<JsonBodyResult<T>> {
  const length = request.headers.get("content-length");
  if (length) {
    const parsed = Number(length);
    if (Number.isFinite(parsed) && parsed > maxBytes) {
      return { ok: false, reason: "too_large" };
    }
  }

  let text: string;
  try {
    text = await request.text();
  } catch {
    return { ok: false, reason: "invalid_json" };
  }

  if (Buffer.byteLength(text, "utf8") > maxBytes) {
    return { ok: false, reason: "too_large" };
  }

  try {
    return { ok: true, value: JSON.parse(text) as T };
  } catch {
    return { ok: false, reason: "invalid_json" };
  }
}
