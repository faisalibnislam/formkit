import type { Metadata } from "next";
import Link from "next/link";
import { StoryIndex } from "@/components/site/StoryPage";
import { JsonLd, breadcrumb } from "@/components/site/JsonLd";
import { FEATURE_PAGES, USE_CASES } from "@/content/features";
import { SITE_URL } from "@/lib/site";

const description =
  "What Formkit does: build forms with AI, branch them with logic, grade quizzes, reply to answers with AI, take payments and connect your tools.";

export const metadata: Metadata = {
  title: "Features",
  description,
  alternates: { canonical: `${SITE_URL}/features` },
  openGraph: { type: "website", siteName: "Formkit", url: `${SITE_URL}/features`, title: "Features | Formkit", description },
  twitter: { card: "summary_large_image", title: "Formkit features", description },
};

export default function FeaturesPage() {
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            breadcrumb([
              { name: "Formkit", url: `${SITE_URL}/` },
              { name: "Features", url: `${SITE_URL}/features` },
            ]),
          ],
        }}
      />
      <StoryIndex
        stories={FEATURE_PAGES}
        base="features"
        crumb="Features"
        title="Everything a form can do here."
        lead="Build a form by describing it, send each person down the right path, and act on every answer. Each page below shows how it works and which plan it needs."
      >
        <section className="fk-story-block">
          <h2 className="fk-story-h2">By team</h2>
          <div className="fk-story-chips">
            {USE_CASES.map((u) => (
              <Link key={u.slug} href={`/use-cases/${u.slug}`} className="fk-story-chip">
                {u.name}
              </Link>
            ))}
          </div>
        </section>
      </StoryIndex>
    </>
  );
}
