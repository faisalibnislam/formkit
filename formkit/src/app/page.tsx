import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/LandingPage";
import { JsonLd, faqPage, organization, softwareApp } from "@/components/site/JsonLd";
import { LANDING_FAQS } from "@/content/landing";
import { SITE_URL } from "@/lib/site";

const TITLE = "Formkit: the free form builder for client-facing work";
const DESCRIPTION =
  "Formkit is a free online form builder: drag-and-drop questions, conditional logic, your own branding and link, a response inbox with partials, analytics and CSV or Excel export.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/` },
  openGraph: {
    type: "website",
    siteName: "Formkit",
    url: `${SITE_URL}/`,
    title: TITLE,
    description:
      "Design every question, branch the journey with conditional logic, and read what comes back in one inbox with analytics attached. Free, under your own name.",
  },
  twitter: {
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
            softwareApp(SITE_URL),
            faqPage(LANDING_FAQS),
          ],
        }}
      />
      <LandingPage />
    </>
  );
}
