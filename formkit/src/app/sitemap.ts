import type { MetadataRoute } from "next";
import { HELP_ARTICLES } from "@/content/help";
import { TEMPLATES } from "@/content/templates";
import { RIVALS } from "@/content/compare";
import { SITE_URL } from "@/lib/site";
import { SITE_DATES, lastMod } from "@/lib/dates";

/**
 * Every indexable route, each with the date it really last changed (see
 * lib/dates.ts). The app, admin, auth, onboarding and customers' own forms
 * are excluded.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const at = (d: string) => new Date(d);
  const fixed: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: at(SITE_DATES.home), priority: 1, changeFrequency: "weekly" },
    { url: `${SITE_URL}/pricing`, lastModified: at(SITE_DATES.pricing), priority: 0.9, changeFrequency: "monthly" },
    { url: `${SITE_URL}/templates`, lastModified: at(SITE_DATES.templates), priority: 0.9, changeFrequency: "weekly" },
    { url: `${SITE_URL}/compare`, lastModified: at(SITE_DATES.compare), priority: 0.8, changeFrequency: "monthly" },
    { url: `${SITE_URL}/help`, lastModified: at(SITE_DATES.help), priority: 0.8, changeFrequency: "weekly" },
    { url: `${SITE_URL}/api-docs`, lastModified: at(SITE_DATES.apiDocs), priority: 0.4, changeFrequency: "monthly" },
    { url: `${SITE_URL}/contact`, lastModified: at(SITE_DATES.contact), priority: 0.5, changeFrequency: "yearly" },
    { url: `${SITE_URL}/privacy`, lastModified: at(SITE_DATES.legal), priority: 0.3, changeFrequency: "yearly" },
    { url: `${SITE_URL}/terms`, lastModified: at(SITE_DATES.legal), priority: 0.3, changeFrequency: "yearly" },
    { url: `${SITE_URL}/dpa`, lastModified: at(SITE_DATES.legal), priority: 0.2, changeFrequency: "yearly" },
  ];

  return [
    ...fixed,
    ...TEMPLATES.map((t) => ({
      url: `${SITE_URL}/templates/${t.slug}`,
      lastModified: lastMod(t.updated, SITE_DATES.templates),
      priority: 0.8,
      changeFrequency: "monthly" as const,
    })),
    ...RIVALS.map((r) => ({
      url: `${SITE_URL}/compare/${r.slug}`,
      lastModified: lastMod(r.updated, SITE_DATES.compare),
      priority: 0.7,
      changeFrequency: "monthly" as const,
    })),
    ...HELP_ARTICLES.map((a) => ({
      url: `${SITE_URL}/help/${a.id}`,
      lastModified: lastMod(a.updated, SITE_DATES.help),
      priority: 0.6,
      changeFrequency: "monthly" as const,
    })),
  ];
}
