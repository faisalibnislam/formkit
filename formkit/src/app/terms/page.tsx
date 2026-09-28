import type { Metadata } from "next";
import { LegalDocument } from "@/components/site/LegalDocument";
import { JsonLd, breadcrumb } from "@/components/site/JsonLd";
import { LEGAL_UPDATED, TERMS, TERMS_FOOT } from "@/content/legal";
import { SHARE_IMAGE, SITE_URL } from "@/lib/site";

const TITLE = "Terms of service";
const DESCRIPTION =
  "The agreement between you and Formkit: your account, your content, what counts as fair use, and how either side can end it.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/terms` },
  openGraph: {
    images: [SHARE_IMAGE],
    type: "article",
    siteName: "Formkit",
    url: `${SITE_URL}/terms`,
    title: `${TITLE} | Formkit`,
    description: DESCRIPTION,
  },
};

export default function TermsPage() {
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            breadcrumb([
              { name: "Formkit", url: `${SITE_URL}/` },
              { name: "Terms of service", url: `${SITE_URL}/terms` },
            ]),
          ],
        }}
      />
      <LegalDocument
        title={TITLE}
        intro={DESCRIPTION}
        updated={LEGAL_UPDATED}
        sections={TERMS}
        foot={TERMS_FOOT}
      />
    </>
  );
}
