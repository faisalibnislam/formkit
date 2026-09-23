import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/LandingPage";
import { JsonLd, faqPage, organization } from "@/components/site/JsonLd";
import { LANDING_FAQS } from "@/content/landing";
import { SHARE_IMAGE, SITE_URL } from "@/lib/site";

const TITLE = "Formkit — the free form builder for client-facing work";
const DESCRIPTION =
  "Formkit is a free online form builder: drag-and-drop questions, conditional logic, your own branding and link, a response inbox with partials, analytics and CSV or Excel export.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/` },
  openGraph: {
    images: [SHARE_IMAGE],
    type: "website",
    siteName: "Formkit",
    url: `${SITE_URL}/`,
    title: TITLE,
    description:
      "Design every question, branch the journey with conditional logic, and read what comes back in one inbox with analytics attached. Free, under your own name.",
  },
  twitter: {
    images: [SHARE_IMAGE],
    card: "summary_large_image",
    title: TITLE,
    description: "Build forms, add logic, read the responses. Free, under your own link.",
  },
};

export default function Home() {
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            organization(SITE_URL),
            {
              "@type": "SoftwareApplication",
              name: "Formkit",
              applicationCategory: "BusinessApplication",
              operatingSystem: "Web",
              url: `${SITE_URL}/`,
              description:
                "Online form builder with conditional logic, branding, a response inbox, analytics and CSV or Excel export.",
              offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
              featureList: [
                "Drag-and-drop form builder",
                "Conditional logic",
                "Themes and branding",
                "Custom link per person or company",
                "Response inbox with partial responses",
                "Analytics and drop-off",
                "Email notifications and routing",
                "Collaborators with roles",
                "Version history",
                "CSV and Excel export",
              ],
            },
            faqPage(LANDING_FAQS),
          ],
        }}
      />
      <LandingPage />
    </>
  );
}
