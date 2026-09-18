import type { MetadataRoute } from "next";

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tharros.ca";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/pricing", "/privacy", "/terms", "/security"],
      disallow: [
        "/api/",
        "/admin/",
        "/assistant",
        "/auth/",
        "/billing",
        "/dashboard",
        "/invite/",
        "/knowledge",
        "/notifications",
        "/onboarding",
        "/portal",
        "/profile",
        "/scheduling",
        "/settings",
        "/verify-email",
        "/forgot-password",
        "/reset-password",
        "/login",
        "/signup",
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
