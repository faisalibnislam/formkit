import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Glyph } from "@/components/brand/Glyph";
import { StoryIndex } from "@/components/site/StoryPage";
import { FeatureShowcase } from "@/components/site/FeatureShowcase";
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
        showcase={
          <FeatureShowcase
            items={FEATURE_PAGES.map(({ slug, name, icon, title, lead, plan }) => ({ slug, name, icon, title, lead, plan }))}
          />
        }
        title="Everything a form can do here."
        lead="Build a form by describing it, send each person down the right path, and act on every answer. Every feature below is live: click around and see how it works."
      >
        <section className="fk-story-block" data-rise>
          <h2 className="fk-story-h2">Made for your team</h2>
          <div className="fk-teams">
            {USE_CASES.map((u) => (
              <Link key={u.slug} href={`/use-cases/${u.slug}`} className="fk-team">
                <span className="fk-tpl-tile">
                  <Glyph name={u.icon} size={20} />
                </span>
                <b>{u.name}</b>
                <span>{u.kicker}</span>
                <ArrowRight size={16} strokeWidth={1.8} aria-hidden />
              </Link>
            ))}
          </div>
        </section>
      </StoryIndex>
    </>
  );
}
