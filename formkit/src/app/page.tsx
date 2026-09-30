import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/LandingPage";
import { JsonLd, faqPage, organization, softwareApp } from "@/components/site/JsonLd";
import { LANDING_FAQS } from "@/content/landing";
import { SITE_URL } from "@/lib/site";

const TITLE = "Formkit: free AI form builder with logic and payments";
const DESCRIPTION =
  "Build forms with AI, add logic that reads answers, take payments and reply to every response automatically. Unlimited forms, responses and members free.";

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
      "Describe a form and Formkit builds it. Branch the journey with logic that reads answers, take payments, and reply to every response with AI. Free to start.",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: "Build forms with AI, add logic, take payments and reply to every response. Free to start.",
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
