import type { Metadata } from "next";
import { LegalDocument } from "@/components/site/LegalDocument";
import { JsonLd, breadcrumb } from "@/components/site/JsonLd";
import { DPA, DPA_FOOT, LEGAL_UPDATED } from "@/content/legal";
import { SHARE_IMAGE, SITE_URL } from "@/lib/site";

const TITLE = "Data processing agreement";
const DESCRIPTION =
  "How Formkit handles the personal data in your forms' responses on your behalf: what we process, who helps us, how we keep it safe and when it is deleted.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/dpa` },
  openGraph: {
    images: [SHARE_IMAGE],
    type: "article",
    siteName: "Formkit",
    url: `${SITE_URL}/dpa`,
    title: `${TITLE} — Formkit`,
    description: DESCRIPTION,
  },
};

export default function DpaPage() {
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            breadcrumb([
              { name: "Formkit", url: `${SITE_URL}/` },
              { name: TITLE, url: `${SITE_URL}/dpa` },
            ]),
          ],
        }}
      />
      <LegalDocument title={TITLE} intro={DESCRIPTION} updated={LEGAL_UPDATED} sections={DPA} foot={DPA_FOOT} />
    </>
  );
}
