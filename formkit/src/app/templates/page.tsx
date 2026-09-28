import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { NightSky } from "@/components/brand/NightSky";
import { Glyph } from "@/components/brand/Glyph";
import { PublicPage } from "@/components/site/PublicPage";
import { JsonLd, breadcrumb } from "@/components/site/JsonLd";
import { TEMPLATES } from "@/content/templates";
import { SHARE_IMAGE, SITE_URL } from "@/lib/site";

const TITLE = "Form templates";
const DESCRIPTION =
  "Six free form templates you can publish today: client onboarding, website questionnaire, customer feedback, lead qualification, event registration and product research. Every question written, every answer type set.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/templates` },
  openGraph: {
    images: [SHARE_IMAGE],
    type: "website",
    siteName: "Formkit",
    url: `${SITE_URL}/templates`,
    title: "Free form templates | Formkit",
    description:
      "Working forms, not starting points. Change every word, publish under your own link.",
  },
  twitter: { card: "summary_large_image", images: [SHARE_IMAGE] },
};

const HOW = [
  {
    title: "Every question is written",
    body: "Not a heading and three placeholders. The real wording, with the right answer type on each question and the pages already split.",
  },
  {
    title: "Change anything",
    body: "A template becomes your draft the moment you use it. Rewrite a question, drop three, add a page, re-theme it. Nothing stays linked to the original.",
  },
  {
    title: "Publish under your own link",
    body: "Claim a handle and the form goes out at formkit.app/your-name/your-form. Free, like the rest of it.",
  },
];

export default function TemplatesPage() {
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            breadcrumb([
              { name: "Formkit", url: `${SITE_URL}/` },
              { name: "Templates", url: `${SITE_URL}/templates` },
            ]),
            {
              "@type": "ItemList",
              itemListElement: TEMPLATES.map((t, i) => ({
                "@type": "ListItem",
                position: i + 1,
                name: t.name,
                url: `${SITE_URL}/templates/${t.slug}`,
              })),
            },
          ],
        }}
      />

      <PublicPage current="templates">
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
              <span style={{ color: "#ffffff" }}>Templates</span>
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
              Six forms, already written.
            </h1>
            <p
              style={{
                margin: "18px 0 0",
                maxWidth: "58ch",
                fontSize: 17,
                lineHeight: 1.6,
                color: "#ffffff",
                opacity: 0.88,
                textWrap: "pretty",
              }}
            >
              Working forms rather than starting points. Every question worded, every
              answer type set, the pages already split. Change as much as you like, then
              publish under your own link.
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
            <div className="fk-tpl-grid">
              {TEMPLATES.map((t) => (
                <Link key={t.slug} href={`/templates/${t.slug}`} className="fk-tpl-card">
                  <span className="fk-tpl-tile">
                    <Glyph name={t.icon} size={20} />
                  </span>
                  <span className="fk-tpl-name">{t.name}</span>
                  <span className="fk-tpl-blurb">{t.blurb}</span>
                  <span className="fk-tpl-meta">
                    <span>{t.questions.length} questions</span>
                    <span>·</span>
                    <span>{t.time}</span>
                    {t.logic && (
                      <>
                        <span>·</span>
                        <span>Logic included</span>
                      </>
                    )}
                  </span>
                  <span className="fk-tpl-more">
                    See the questions
                    <ArrowRight size={15} strokeWidth={1.8} aria-hidden />
                  </span>
                </Link>
              ))}
            </div>

            <h2
              style={{
                margin: "clamp(44px,6vw,80px) 0 0",
                fontSize: "clamp(22px,2.8vw,34px)",
                fontWeight: 700,
                letterSpacing: "-.03em",
              }}
            >
              How Formkit templates work
            </h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(min(260px,100%),1fr))",
                gap: 18,
                marginTop: 22,
              }}
            >
              {HOW.map((h) => (
                <div
                  key={h.title}
                  style={{
                    padding: 22,
                    borderRadius: "var(--radius-card)",
                    background: "var(--neutral-50)",
                  }}
                >
                  <h3 style={{ margin: 0, fontSize: 16.5, fontWeight: 500 }}>{h.title}</h3>
                  <p
                    style={{
                      margin: "8px 0 0",
                      fontSize: 14.5,
                      lineHeight: 1.6,
                      color: "var(--color-text-secondary)",
                      textWrap: "pretty",
                    }}
                  >
                    {h.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </main>
      </PublicPage>
    </>
  );
}
