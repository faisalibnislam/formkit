/**
 * When each public page last changed, for the sitemap and for articles'
 * structured data. Search engines trust a "last modified" date only when it
 * moves with real changes, so these are set by hand when content changes,
 * never to "now".
 */
export const SITE_DATES = {
  home: "2026-10-15",
  pricing: "2026-10-17",
  templates: "2026-09-30",
  compare: "2026-10-15",
  help: "2026-10-17",
  features: "2026-10-17",
  useCases: "2026-09-30",
  changelog: "2026-10-17",
  contact: "2026-10-15",
  apiDocs: "2026-10-15",
  legal: "2026-09-21",
  privacy: "2026-10-14",
  dpa: "2026-10-14",
} as const;

/** A content item's own date, or its collection's. */
export const lastMod = (own: string | undefined, fallback: string) => new Date(own ?? fallback);
