import type { MetadataRoute } from "next";

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tharros.ca";

// Allow crawling of public marketing pages; keep the authenticated app and API
// out of the index. These paths are auth-gated regardless — this is best-effort
// crawler guidance, not a security boundary.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/assistant",
        "/automations",
        "/billing",
        "/dashboard",
        "/leads",
        "/profile",
        "/settings",
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
