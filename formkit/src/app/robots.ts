import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * Mirrors the `noindex` intent in the page metadata: the application, the admin
 * console, auth and onboarding are never indexed.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/app", "/app/", "/admin", "/admin/", "/signin", "/signup", "/onboarding", "/api/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
