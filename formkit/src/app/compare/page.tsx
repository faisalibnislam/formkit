import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { NightSky } from "@/components/brand/NightSky";
import { PublicPage } from "@/components/site/PublicPage";
import { CompareTable } from "@/components/site/CompareTable";
import { JsonLd, breadcrumb } from "@/components/site/JsonLd";
import { COMPARE_ASOF, RIVALS } from "@/content/compare";
import { SITE_URL } from "@/lib/site";

const TITLE = "Compare form builders";
const DESCRIPTION =
  "An honest comparison of Formkit with Google Forms and Typeform, based on each product's published free tier.";

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
            <h1
              style={{
                margin: 0,
                maxWidth: "18ch",
                fontSize: "clamp(32px,5vw,60px)",
                fontWeight: 700,
                letterSpacing: "-.04em",
                lineHeight: 1.02,
                color: "#ffffff",
              }}
            >
              Three ways to ask a question
            </h1>
            <p
              style={{
                margin: "18px 0 0",
                maxWidth: "60ch",
                fontSize: 17,
                lineHeight: 1.6,
                color: "#ffffff",
                opacity: 0.88,
                textWrap: "pretty",
              }}
            >
              Google Forms, Typeform and Formkit all collect answers well. This is what
              each one gives you for free, stated plainly, without attack language or
              invented specifications.
            </p>
          </div>
        </section>

        <main
          id="fk-main"
          className="fk-main"
          style={{
            padding: "clamp(34px,5vw,64px) clamp(20px,5vw,56px) clamp(44px,6vw,72px)",
          }}
        >
          <div className="fk-measure">
            <h2
              style={{
                margin: 0,
                fontSize: "clamp(22px,2.8vw,34px)",
                fontWeight: 700,
                letterSpacing: "-.03em",
              }}
            >
              What each free tier gives you
            </h2>
            <p
              style={{
                margin: "10px 0 22px",
                maxWidth: "62ch",
                fontSize: 14.5,
                lineHeight: 1.6,
                color: "var(--color-text-tertiary)",
              }}
            >
              Based on each product&rsquo;s published free tier, {COMPARE_ASOF}. A dash
              means the feature exists but is narrower, never that it is missing.
            </p>

            <CompareTable />

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(min(300px,100%),1fr))",
                gap: 18,
                marginTop: "clamp(36px,5vw,64px)",
              }}
            >
              {RIVALS.map((r) => (
                <Link key={r.slug} href={`/compare/${r.slug}`} className="fk-rival-card">
                  <span style={{ fontSize: 19, fontWeight: 500, letterSpacing: "-.01em" }}>
                    Formkit vs {r.name}
                  </span>
                  <span
                    style={{
                      marginTop: 8,
                      fontSize: 14.5,
                      lineHeight: 1.6,
                      color: "var(--color-text-secondary)",
                      textWrap: "pretty",
                    }}
                  >
                    {r.line}
                  </span>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 7,
                      marginTop: 16,
                      fontSize: 14,
                      fontWeight: 500,
                      color: "var(--blue-700)",
                    }}
                  >
                    Read the comparison
                    <ArrowRight size={15} strokeWidth={1.8} aria-hidden />
                  </span>
                </Link>
              ))}
            </div>

            <p
              style={{
                margin: "clamp(36px,5vw,56px) 0 0",
                maxWidth: "52ch",
                fontSize: "clamp(18px,2.2vw,24px)",
                lineHeight: 1.45,
                fontWeight: 500,
                letterSpacing: "-.02em",
              }}
            >
              Choose the tool that fits the job. Choose Formkit when the form is part of
              how people see you.
            </p>
          </div>
        </main>
      </PublicPage>
    </>
  );
}
