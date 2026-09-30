import type { Metadata } from "next";
import Link from "next/link";
import { NightSky } from "@/components/brand/NightSky";
import { PublicPage } from "@/components/site/PublicPage";
import { JsonLd, breadcrumb } from "@/components/site/JsonLd";
import { CHANGELOG } from "@/content/changelog";
import { SITE_URL } from "@/lib/site";

const description =
  "What is new in Formkit: quizzes, AI replies and insights, logic, companies and per-seat plans, custom domains and more, newest first.";

export const metadata: Metadata = {
  title: "Changelog",
  description,
  alternates: { canonical: `${SITE_URL}/changelog` },
  openGraph: { type: "website", siteName: "Formkit", url: `${SITE_URL}/changelog`, title: "Changelog | Formkit", description },
  twitter: { card: "summary_large_image", title: "Formkit changelog", description },
};

const DAY = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

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
          </div>
        </section>
        <main id="fk-main" className="fk-main fk-story-main">
          <div className="fk-measure">
            <ol className="fk-log">
              {CHANGELOG.map((e) => (
                <li key={e.date + e.title} className="fk-log-item">
                  <time className="fk-log-date" dateTime={e.date}>
                    {DAY.format(new Date(`${e.date}T00:00:00Z`))}
                  </time>
                  <div>
                    <h2>
                      {e.title}
                      {e.tag && <span className="fk-log-tag">{e.tag}</span>}
                    </h2>
                    <p>{e.body}</p>
                    {e.points && (
                      <ul>
                        {e.points.map((pt) => (
                          <li key={pt}>{pt}</li>
                        ))}
                      </ul>
                    )}
                    {e.links && (
                      <div className="fk-log-links">
                        {e.links.map((l) => (
                          <Link key={l.href} href={l.href}>
                            {l.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </main>
      </PublicPage>
    </>
  );
}
