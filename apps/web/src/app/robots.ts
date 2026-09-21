import type { MetadataRoute } from "next";

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tharros.ca";

/**
 * The only indexable surfaces are the public marketing pages, which is the
 * same list the sitemap publishes. Everything else is stated as an inverse of
 * that rather than as a hand-maintained deny list, because the hand-maintained
 * one had drifted: /leads, /automations and /forms were all missing from it.
 */
const PUBLIC_PATHS = [
  "/",
  "/pricing",
  "/privacy",
  "/terms",
  "/security",
  "/products",
  "/solutions",
  "/how-it-works",
  "/contact",
];

/**
 * Every other top-level route the app serves. Adding a route group or a new
 * product surface means adding it here, and the test below fails if a route
 * exists that neither list accounts for.
 */
const PRIVATE_PATHS = [
  "/api/",
  "/admin/",
  "/assistant",
  "/auth/",
  "/automations",
  "/billing",
  "/dashboard",
  "/forgot-password",
  "/forms",
  "/invite/",
  "/knowledge",
  "/leads",
  "/login",
  "/notifications",
  "/onboarding",
  "/portal",
  "/profile",
  "/reset-password",
  "/scheduling",
  "/settings",
  "/signup",
  "/verify-email",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: PUBLIC_PATHS,
      disallow: PRIVATE_PATHS,
    },
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}

export { PRIVATE_PATHS, PUBLIC_PATHS };
