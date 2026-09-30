import type { Metadata } from "next";
import { StoryIndex } from "@/components/site/StoryPage";
import { JsonLd, breadcrumb } from "@/components/site/JsonLd";
import { USE_CASES } from "@/content/features";
import { SITE_URL } from "@/lib/site";

const description =
  "How agencies, schools, sales teams, event organisers and HR teams use Formkit: the templates, logic and plans that fit each one.";

export const metadata: Metadata = {
  title: "Use cases",
  description,
  alternates: { canonical: `${SITE_URL}/use-cases` },
  openGraph: { type: "website", siteName: "Formkit", url: `${SITE_URL}/use-cases`, title: "Use cases | Formkit", description },
  twitter: { card: "summary_large_image", title: "Formkit use cases", description },
};

export default function UseCasesPage() {
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            breadcrumb([
              { name: "Formkit", url: `${SITE_URL}/` },
              { name: "Use cases", url: `${SITE_URL}/use-cases` },
            ]),
          ],
        }}
      />
      <StoryIndex
        stories={USE_CASES}
        base="use-cases"
        crumb="Use cases"
        title="Forms for the way your team works."
        lead="Pick your team to see the forms people like you run on Formkit, the templates to start from and the features that save the most time."
      />
    </>
  );
}
