/**
 * When each public page last changed, for the sitemap and for articles'
 * structured data. Search engines trust a "last modified" date only when it
 * moves with real changes, so these are set by hand when content changes,
 * never to "now".
 */
export const SITE_DATES = {
  home: "2026-09-30",
  pricing: "2026-09-30",
  templates: "2026-09-30",
  compare: "2026-09-30",
  help: "2026-09-30",
  features: "2026-09-30",
  useCases: "2026-09-30",
  changelog: "2026-09-30",
  contact: "2026-09-29",
  apiDocs: "2026-08-20",
  legal: "2026-09-21",
} as const;

/** A content item's own date, or its collection's. */
export const lastMod = (own: string | undefined, fallback: string) => new Date(own ?? fallback);
