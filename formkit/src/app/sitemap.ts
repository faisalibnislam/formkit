import type { MetadataRoute } from "next";
import { HELP_ARTICLES } from "@/content/help";
import { TEMPLATES } from "@/content/templates";
import { RIVALS } from "@/content/compare";
import { SITE_URL } from "@/lib/site";

/** Every indexable route. The app, admin, auth and onboarding are excluded. */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const fixed: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, priority: 1, changeFrequency: "weekly" },
    { url: `${SITE_URL}/templates`, priority: 0.9, changeFrequency: "monthly" },
    { url: `${SITE_URL}/pricing`, priority: 0.9, changeFrequency: "monthly" },
    { url: `${SITE_URL}/compare`, priority: 0.8, changeFrequency: "monthly" },
    { url: `${SITE_URL}/help`, priority: 0.8, changeFrequency: "weekly" },
    { url: `${SITE_URL}/contact`, priority: 0.5, changeFrequency: "yearly" },
    { url: `${SITE_URL}/privacy`, priority: 0.3, changeFrequency: "yearly" },
    { url: `${SITE_URL}/terms`, priority: 0.3, changeFrequency: "yearly" },
    { url: `${SITE_URL}/dpa`, priority: 0.2, changeFrequency: "yearly" },
  ];

  return [
    ...fixed,
    ...TEMPLATES.map((t) => ({
      url: `${SITE_URL}/templates/${t.slug}`,
      priority: 0.8,
      changeFrequency: "monthly" as const,
    })),
    ...RIVALS.map((r) => ({
      url: `${SITE_URL}/compare/${r.slug}`,
      priority: 0.7,
      changeFrequency: "monthly" as const,
    })),
    ...HELP_ARTICLES.map((a) => ({
      url: `${SITE_URL}/help/${a.id}`,
      priority: 0.6,
      changeFrequency: "monthly" as const,
    })),
  ].map((entry) => ({ lastModified: now, ...entry }));
}
