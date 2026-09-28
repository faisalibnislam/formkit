import type { Metadata } from "next";
import Link from "next/link";
import { NightSky } from "@/components/brand/NightSky";
import { Glyph } from "@/components/brand/Glyph";
import { PublicPage } from "@/components/site/PublicPage";
import { HelpSearch } from "@/components/site/HelpSearch";
import { HelpCta } from "@/components/site/HelpCta";
import { JsonLd, breadcrumb, organization } from "@/components/site/JsonLd";
import { HELP_ARTICLES, HELP_CATEGORIES } from "@/content/help";
import { SHARE_IMAGE, SITE_URL } from "@/lib/site";

const TITLE = "Help center";
const DESCRIPTION = `Guides for building forms, sharing them and reading what comes back — ${HELP_ARTICLES.length} articles across ${HELP_CATEGORIES.length} categories.`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/help` },
  openGraph: {
    images: [SHARE_IMAGE],
    type: "website",
    siteName: "Formkit",
    url: `${SITE_URL}/help`,
    title: `${TITLE} — Formkit`,
    description: DESCRIPTION,
  },
};

const POPULAR = [
  { label: "Create your first form", href: "/help/create-first-form" },
  { label: "Logic rules", href: "/help/logic-basics" },
  { label: "Your own link", href: "/help/claim-handle" },
  { label: "Exports", href: "/help/export-responses" },
];

export default function HelpPage() {
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            organization(SITE_URL),
            breadcrumb([
              { name: "Formkit", url: `${SITE_URL}/` },
              { name: "Help center", url: `${SITE_URL}/help` },
            ]),
            {
              "@type": "WebSite",
              name: "Formkit help center",
              url: `${SITE_URL}/help`,
              potentialAction: {
                "@type": "SearchAction",
                target: `${SITE_URL}/help?q={search_term_string}`,
                "query-input": "required name=search_term_string",
              },
            },
          ],
        }}
      />

      <PublicPage current="help">
        <section
          className="fk-hero"
          style={{
            padding:
              "calc(104px + clamp(20px,4vw,44px)) clamp(20px,5vw,56px) clamp(48px,6vw,72px)",
          }}
        >
          <NightSky />
          <div className="fk-hero-inner fk-measure">
            <h1
              style={{
                margin: 0,
                maxWidth: "16ch",
                fontSize: "clamp(32px,5vw,60px)",
                fontWeight: 700,
                letterSpacing: "-.04em",
                lineHeight: 1.02,
                color: "#ffffff",
              }}
            >
              How can we help?
            </h1>
            <p
              style={{
                margin: "16px 0 26px",
                maxWidth: "56ch",
                fontSize: 17,
                lineHeight: 1.6,
                color: "#ffffff",
                opacity: 0.88,
                textWrap: "pretty",
              }}
            >
              Guides for building forms, sharing them and reading what comes back.
            </p>

            <HelpSearch />

            <div
              style={{ display: "flex", gap: 9, flexWrap: "wrap", marginTop: 22 }}
            >
              {POPULAR.map((p) => (
                <Link key={p.href} href={p.href} className="fk-chip-on-sky">
                  {p.label}
                </Link>
              ))}
            </div>
          </div>
        </section>

        <main
          id="fk-main"
          className="fk-main"
          style={{
            padding: "clamp(34px,5vw,64px) clamp(20px,5vw,56px) clamp(44px,6vw,72px)",
          }}
        >
          <div className="fk-measure fk-help-grid">
            {HELP_CATEGORIES.map((cat) => (
              <section key={cat.id} className="fk-help-cat" aria-labelledby={`c-${cat.id}`}>
                <div className="fk-help-cat-head">
                  <span className="fk-help-cat-tile">
                    <Glyph name={cat.icon} size={18} />
                  </span>
                  <h2
                    id={`c-${cat.id}`}
                    style={{ margin: 0, fontSize: 18, fontWeight: 500 }}
                  >
                    {cat.name}
                  </h2>
                </div>
                <p
                  style={{
                    margin: "12px 0 0",
                    fontSize: 14.5,
                    lineHeight: 1.6,
                    color: "var(--color-text-secondary)",
                    textWrap: "pretty",
                  }}
                >
                  {cat.desc}
                </p>
                <div className="fk-help-cat-links">
                  {cat.articles.map((a) => (
                    <Link key={a.id} href={`/help/${a.id}`}>
                      {a.title}
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>
          <div className="fk-measure">
            <HelpCta />
          </div>
        </main>
      </PublicPage>
    </>
  );
}
