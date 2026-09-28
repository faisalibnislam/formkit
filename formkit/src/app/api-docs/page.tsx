import type { Metadata } from "next";
import { LegalDocument } from "@/components/site/LegalDocument";
import { API_DOCS, API_FOOT } from "@/content/apiDocs";
import { LEGAL_UPDATED } from "@/content/legal";
import { SHARE_IMAGE, SITE_URL } from "@/lib/site";

const TITLE = "API and webhooks";
const DESCRIPTION = "Read your forms and responses from your own code, and check that webhooks really came from Formkit.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/api-docs` },
  openGraph: {
    images: [SHARE_IMAGE],
    type: "article",
    siteName: "Formkit",
    url: `${SITE_URL}/api-docs`,
    title: `${TITLE} — Formkit`,
    description: DESCRIPTION,
  },
};

export default function ApiDocsPage() {
  return (
    <LegalDocument
      eyebrow="DEVELOPERS"
      title={TITLE}
      intro={DESCRIPTION}
      updated={LEGAL_UPDATED}
      sections={API_DOCS}
      foot={API_FOOT}
    />
  );
}
