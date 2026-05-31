import type { MetadataRoute } from "next";

// Canonical production origin. Override with NEXT_PUBLIC_SITE_URL in non-prod
// environments (e.g. preview deployments) if you want absolute URLs to match.
const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tharros.ca";

// Only public, indexable marketing routes belong here. The authenticated app
// (assistant, dashboard, settings, etc.) and /api are intentionally excluded.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
