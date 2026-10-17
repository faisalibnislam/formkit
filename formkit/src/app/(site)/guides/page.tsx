import type { Metadata } from "next";
import { StoryIndex } from "@/components/site/StoryPage";
import { JsonLd, breadcrumb } from "@/components/site/JsonLd";
import { GUIDE_PAGES } from "@/content/guides";
import { SITE_URL } from "@/lib/site";

const title = "Form guides: payments, logic and Google Sheets";
const description =
  "Step-by-step guides to building better online forms: taking payments, adding conditional logic and sending responses to Google Sheets.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: `${SITE_URL}/guides` },
  openGraph: { type: "website", siteName: "Formkit", url: `${SITE_URL}/guides`, title: `${title} | Formkit`, description },
  twitter: { card: "summary_large_image", title: `${title} | Formkit`, description },
};

export default function GuidesPage() {
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            breadcrumb([
              { name: "Formkit", url: `${SITE_URL}/` },
              { name: "Guides", url: `${SITE_URL}/guides` },
            ]),
            {
              "@type": "ItemList",
              itemListElement: GUIDE_PAGES.map((p, i) => ({ "@type": "ListItem", position: i + 1, name: p.name, url: `${SITE_URL}/guides/${p.slug}` })),
            },
          ],
        }}
      />
      <StoryIndex
        stories={GUIDE_PAGES}
        base="guides"
        crumb="Guides"
        title="Guides to building better forms."
        lead="Plain, step-by-step guides to the things forms are hardest to get right: taking payments, branching on answers and getting responses where you need them."
      />
    </>
  );
}
