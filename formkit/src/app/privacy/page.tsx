import type { Metadata } from "next";
import { LegalDocument } from "@/components/site/LegalDocument";
import { JsonLd, breadcrumb } from "@/components/site/JsonLd";
import { LEGAL_UPDATED, PRIVACY, PRIVACY_FOOT } from "@/content/legal";
import { SITE_URL } from "@/lib/site";

const TITLE = "Privacy policy";
const DESCRIPTION =
  "What Formkit collects, how long it is kept, who can see it, and how to delete your forms, responses and account.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/privacy` },
  openGraph: {
    type: "article",
    siteName: "Formkit",
    url: `${SITE_URL}/privacy`,
    title: `${TITLE} — Formkit`,
    description: DESCRIPTION,
  },
};

export default function PrivacyPage() {
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            breadcrumb([
              { name: "Formkit", url: `${SITE_URL}/` },
              { name: "Privacy policy", url: `${SITE_URL}/privacy` },
            ]),
          ],
        }}
      />
      <LegalDocument
        title={TITLE}
        intro="What Formkit collects, how long it is kept, who can see it, and how to get rid of it. Your account is ours to look after; the answers in your forms are yours."
        updated={LEGAL_UPDATED}
        sections={PRIVACY}
        foot={PRIVACY_FOOT}
      />
    </>
  );
}
