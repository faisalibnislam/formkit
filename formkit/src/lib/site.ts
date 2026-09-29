/** The canonical origin. Canonicals, Open Graph URLs and the sitemap read this. */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://formkit.app";

export const SITE_NAME = "Formkit";

/**
 * The picture a shared link shows. Every page that sets its own Open Graph or
 * Twitter metadata lists it too: a page's `openGraph` replaces the layout's
 * whole object rather than merging into it, so an image set once at the root
 * would silently vanish from those pages.
 */
export const SHARE_IMAGE = {
  url: "/og-image.jpg",
  width: 1200,
  height: 630,
  alt: "Formkit: What will your next form do? Design the questions, branch the journey, read what comes back.",
};

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
      { label: "Contact us", href: "/contact" },
    ],
  },
] as const;

/** Two honest product facts that several pages state rather than hide. */
export const UPLOAD_CAP_MB = 20;
export const LANGUAGE = "English (US)";

/**
 * Formkit's own hosts. Any other host reaching the app is a customer's custom
 * domain (forms.acme.com), which the proxy maps onto their forms.
 */
const OWN_HOSTS = new Set(
  ["formkit.app", "www.formkit.app", "localhost", "127.0.0.1", new URL(SITE_URL).hostname].filter(Boolean),
);

export function isOwnHost(host: string) {
  return OWN_HOSTS.has(host) || host.endsWith(".vercel.app") || host.endsWith(".localhost");
}
