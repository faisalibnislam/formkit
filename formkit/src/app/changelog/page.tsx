import type { Metadata } from "next";
import Link from "next/link";
import { NightSky } from "@/components/brand/NightSky";
import { PublicPage } from "@/components/site/PublicPage";
import { JsonLd, breadcrumb } from "@/components/site/JsonLd";
import { CHANGELOG } from "@/content/changelog";
import { ChangelogList } from "@/components/site/ChangelogList";
import { SITE_URL } from "@/lib/site";

const description =
  "What is new in Formkit: quizzes, AI replies and insights, logic, companies and per-seat plans, custom domains and more, newest first.";

export const metadata: Metadata = {
  title: "Changelog: what's new",
  description,
  alternates: { canonical: `${SITE_URL}/changelog` },
  openGraph: { type: "website", siteName: "Formkit", url: `${SITE_URL}/changelog`, title: "Changelog: what's new in Formkit", description },
  twitter: { card: "summary_large_image", title: "Formkit changelog", description },
};

const DAY = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

const first = CHANGELOG[CHANGELOG.length - 1]!.date;

export default function ChangelogPage() {
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            breadcrumb([
              { name: "Formkit", url: `${SITE_URL}/` },
              { name: "Changelog", url: `${SITE_URL}/changelog` },
            ]),
          ],
        }}
      />
      <PublicPage>
        <section className="fk-hero fk-story-hero">
          <NightSky />
          <div className="fk-hero-inner fk-measure">
            <nav aria-label="Breadcrumb" className="fk-crumbs">
              <Link href="/">Formkit</Link>
              <span>/</span>
              <span style={{ color: "#ffffff" }}>Changelog</span>
            </nav>
            <h1 className="fk-story-title">What is new in Formkit.</h1>
            <p className="fk-story-lead">
              Everything that changed for the people using Formkit, newest first. Plans named here are the plans
              today.
            </p>
            <ul className="fk-cmp-facts">
              <li>
                <b>{CHANGELOG.length}</b> updates
              </li>
              <li>
                <b>{CHANGELOG.filter((e) => e.tag === "New").length}</b> new features
              </li>
              <li>Since {DAY.format(new Date(`${first}T00:00:00Z`))}</li>
            </ul>
          </div>
        </section>
        <main id="fk-main" className="fk-main fk-story-main">
          <div className="fk-measure">
            <ChangelogList entries={CHANGELOG} />
          </div>
        </main>
      </PublicPage>
    </>
  );
}
