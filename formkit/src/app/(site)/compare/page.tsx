import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarCheck, FileCheck } from "lucide-react";
import { NightSky } from "@/components/brand/NightSky";
import { PublicPage } from "@/components/site/PublicPage";
import { CompareTable } from "@/components/site/CompareTable";
import { Reveal } from "@/components/site/Reveal";
import { FreeLimits } from "@/components/compare/FreeLimits";
import { Beyond } from "@/components/compare/Beyond";
import { RivalCard } from "@/components/compare/RivalCard";
import { JsonLd, breadcrumb } from "@/components/site/JsonLd";
import { COMPARE_ASOF, RIVALS } from "@/content/compare";
import { SITE_URL } from "@/lib/site";

const TITLE = "Compare form builders";
const DESCRIPTION =
  "Formkit compared honestly with Google Forms, Typeform, Jotform, Tally, Fillout, Microsoft Forms, SurveyMonkey and Paperform, on published pricing.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/compare` },
  openGraph: {
    type: "website",
    siteName: "Formkit",
    url: `${SITE_URL}/compare`,
    title: `${TITLE} | Formkit`,
    description: DESCRIPTION,
  },
};

export default function ComparePage() {
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            breadcrumb([
              { name: "Formkit", url: `${SITE_URL}/` },
              { name: "Compare", url: `${SITE_URL}/compare` },
            ]),
          ],
        }}
      />

      <PublicPage current="compare">
        <section
          className="fk-hero"
          style={{
            padding:
              "calc(104px + clamp(20px,4vw,44px)) clamp(20px,5vw,56px) clamp(48px,6vw,72px)",
          }}
        >
          <NightSky />
          <div className="fk-hero-inner fk-measure">
            <nav aria-label="Breadcrumb" className="fk-crumbs">
              <Link href="/">Formkit</Link>
              <span>/</span>
              <span style={{ color: "#ffffff" }}>Compare</span>
            </nav>
            <h1 className="fk-cmp-h1">Formkit, next to the form builders you know</h1>
            <p className="fk-cmp-hero-p">
              Plenty of form builders collect answers well. This is what each one gives
              you for free, stated plainly, without attack language or invented
              specifications.
            </p>
            <ul className="fk-cmp-facts">
              <li>
                <b>{RIVALS.length}</b> form builders
              </li>
              <li>
                <FileCheck size={15} strokeWidth={2} aria-hidden /> Sourced from each pricing page
              </li>
              <li>
                <CalendarCheck size={15} strokeWidth={2} aria-hidden /> Checked {COMPARE_ASOF}
              </li>
            </ul>
          </div>
        </section>

        <main
          id="fk-main"
          className="fk-main"
          style={{
            padding: "clamp(34px,5vw,64px) clamp(20px,5vw,56px) clamp(44px,6vw,72px)",
          }}
        >
          <Reveal className="fk-measure">
            <section className="fk-cmp-sec" data-rise aria-labelledby="cmp-limits">
              <span className="fk-more-kicker">Start with the limit</span>
              <h2 id="cmp-limits" className="fk-cmp-h2">
                How many answers will you collect?
              </h2>
              <p className="fk-cmp-lede">
                A free plan&rsquo;s response limit decides more than any feature. Slide to
                your number and see which free plans still hold it.
              </p>
              <FreeLimits />
            </section>

            <section className="fk-cmp-sec" data-rise aria-labelledby="cmp-table">
              <span className="fk-more-kicker">The two most asked about</span>
              <h2 id="cmp-table" className="fk-cmp-h2">
                Google Forms, Typeform and Formkit
              </h2>
              <p className="fk-cmp-lede">
                Based on each product&rsquo;s published free tier, {COMPARE_ASOF}. A dash
                means the feature exists but is narrower, never that it is missing.
              </p>
              <CompareTable />
            </section>

            <section className="fk-cmp-sec" data-rise aria-labelledby="cmp-beyond">
              <span className="fk-more-kicker">Try it here</span>
              <h2 id="cmp-beyond" className="fk-cmp-h2">
                What a table can&rsquo;t show
              </h2>
              <p className="fk-cmp-lede">
                A tick says a feature exists. These show how it works in Formkit. Click
                around; nothing here needs an account.
              </p>
              <Beyond />
            </section>

            <section className="fk-cmp-sec" data-rise aria-labelledby="cmp-each">
              <span className="fk-more-kicker">One at a time</span>
              <h2 id="cmp-each" className="fk-cmp-h2">
                Every comparison
              </h2>
              <p className="fk-cmp-lede">
                Each one says when to pick the other product, too.
              </p>
              <div className="fk-rc-grid">
                {RIVALS.map((r) => (
                  <RivalCard key={r.slug} r={r} />
                ))}
              </div>
            </section>

            <div className="fk-cmp-close" data-rise>
              <p>
                Choose the tool that fits the job. Choose Formkit when the form is part of
                how people see you.
              </p>
              <Link href="/signup" className="fk-pill fk-pill-dark fk-pill-md">
                Build a form <ArrowRight size={16} strokeWidth={1.8} aria-hidden />
              </Link>
            </div>
          </Reveal>
        </main>
      </PublicPage>
    </>
  );
}
