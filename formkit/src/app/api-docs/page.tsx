import type { Metadata } from "next";
import { LegalDocument } from "@/components/site/LegalDocument";
import { API_DOCS, API_FOOT } from "@/content/apiDocs";
import { SHARE_IMAGE, SITE_URL } from "@/lib/site";
import { JsonLd, article, breadcrumb } from "@/components/site/JsonLd";
import { SITE_DATES } from "@/lib/dates";

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
    title: `${TITLE} | Formkit`,
    description: DESCRIPTION,
  },
};

export default function ApiDocsPage() {
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            article({ headline: TITLE, description: DESCRIPTION, url: `${SITE_URL}/api-docs`, updated: SITE_DATES.apiDocs, section: "Developers" }),
            breadcrumb([
              { name: "Formkit", url: `${SITE_URL}/` },
              { name: TITLE, url: `${SITE_URL}/api-docs` },
            ]),
          ],
        }}
      />
      <LegalDocument
      eyebrow="DEVELOPERS"
      title={TITLE}
      intro={DESCRIPTION}
      updated={new Date(SITE_DATES.apiDocs).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}
      sections={API_DOCS}
      foot={API_FOOT}
      />
    </>
  );
}
