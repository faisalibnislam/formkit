/** The canonical origin. Canonicals, Open Graph URLs and the sitemap read this. */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://formkit.app";

export const SITE_NAME = "Formkit";

/** Routes the public navigation offers, in order. */
export const NAV_LINKS = [
  { id: "product", label: "Product", href: "/#ask" },
  { id: "templates", label: "Templates", href: "/templates" },
  { id: "pricing", label: "Pricing", href: "/pricing" },
  { id: "compare", label: "Compare", href: "/compare" },
  { id: "help", label: "Help center", href: "/help" },
] as const;

export type NavKey = (typeof NAV_LINKS)[number]["id"];

export const FOOTER_COLUMNS = [
  {
    heading: "PRODUCT",
    links: [
      { label: "Form builder", href: "/#ask" },
      { label: "Templates", href: "/templates" },
      { label: "Pricing", href: "/pricing" },
      { label: "Compare", href: "/compare" },
      { label: "Dashboard", href: "/app" },
    ],
  },
  {
    heading: "LEARN",
    links: [
      { label: "Help center", href: "/help" },
      { label: "Getting started", href: "/help/create-first-form" },
      { label: "Logic rules", href: "/help/logic-basics" },
      { label: "Building with AI", href: "/help/ai-what" },
    ],
  },
  {
    heading: "ACCOUNT",
    links: [
      { label: "Sign in", href: "/signin" },
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
    ],
  },
] as const;

/** Two honest product facts that several pages state rather than hide. */
export const UPLOAD_CAP_MB = 10;
export const LANGUAGE = "English (US)";
