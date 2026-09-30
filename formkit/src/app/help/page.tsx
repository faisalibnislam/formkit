import { Fragment } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { NightSky } from "@/components/brand/NightSky";
import { Glyph } from "@/components/brand/Glyph";
import { PublicPage } from "@/components/site/PublicPage";
import { HelpSearch } from "@/components/site/HelpSearch";
import { HelpCta } from "@/components/site/HelpCta";
import { JsonLd, breadcrumb, organization } from "@/components/site/JsonLd";
import { HELP_ARTICLES, HELP_CATEGORIES } from "@/content/help";
import { ArrowRight, Check, GitBranch, Link2, Plus, QrCode, Sparkles } from "lucide-react";
import { SITE_URL } from "@/lib/site";

const TITLE = "Help center";
const DESCRIPTION = `Guides for building forms, sharing them and reading what comes back. ${HELP_ARTICLES.length} articles across ${HELP_CATEGORIES.length} categories.`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/help` },
  openGraph: {
    type: "website",
    siteName: "Formkit",
    url: `${SITE_URL}/help`,
    title: `${TITLE} | Formkit`,
    description: DESCRIPTION,
  },
};

const POPULAR = [
  { label: "Create your first form", href: "/help/create-first-form" },
  { label: "Logic rules", href: "/help/logic-basics" },
  { label: "Companies", href: "/help/add-company" },
  { label: "Cancel or change a plan", href: "/help/auto-renew" },
  { label: "Custom domains", href: "/help/custom-domain" },
];

/** The four guides a new person needs, in order, each with a small drawing of the step. */
const START = [
  { href: "/help/create-first-form", title: "Create your first form", line: "Start blank, from a template, or by describing it to Ask Formkit.", art: "create" },
  { href: "/help/logic-basics", title: "Add logic", line: "Skip, show and hide, so people only answer what applies.", art: "logic" },
  { href: "/help/share-link", title: "Share it", line: "Your own link, an embed on your site, or a QR code.", art: "share" },
  { href: "/help/read-responses", title: "Read the answers", line: "Every response in one inbox, with where people stop.", art: "read" },
] as const;

function StartArt({ kind }: { kind: (typeof START)[number]["art"] }) {
  switch (kind) {
    case "create":
      return (
        <span className="fk-art fk-art-create">
          <span className="fk-art-btn">
            <Plus size={12} strokeWidth={2.6} /> Create form
          </span>
          <span className="fk-art-ai">
            <Sparkles size={11} strokeWidth={2.2} /> “A client intake form”
          </span>
          <span className="fk-art-lines">
            <i />
            <i />
          </span>
        </span>
      );
    case "logic":
      return (
        <span className="fk-art fk-art-logic">
          <span className="fk-art-node">Have we worked together?</span>
          <span className="fk-art-branch">
            <span>
              <GitBranch size={11} strokeWidth={2.2} /> Yes → Scope
            </span>
            <span>No → About you</span>
          </span>
        </span>
      );
    case "share":
      return (
        <span className="fk-art fk-art-share">
          <span className="fk-art-link">
            <Link2 size={12} strokeWidth={2.2} /> formkit.app/you/intake
          </span>
          <span className="fk-art-qr">
            <QrCode size={34} strokeWidth={1.6} />
          </span>
        </span>
      );
    case "read":
      return (
        <span className="fk-art fk-art-read">
          {[
            ["MO", "Maya Okafor", "New"],
            ["DA", "Dele Adeyemi", ""],
            ["JS", "Jonas Sand", ""],
          ].map(([a, n, t]) => (
            <span key={n} className="fk-art-row">
              <i>{a}</i>
              {n}
              {t && (
                <em>
                  <Check size={10} strokeWidth={3} /> {t}
                </em>
              )}
            </span>
          ))}
        </span>
      );
  }
}

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
          <section className="fk-measure fk-help-start" aria-labelledby="start-here">
            <div className="fk-help-start-head">
              <h2 id="start-here">New to Formkit? Start here.</h2>
              <p>Four short guides take you from an empty dashboard to reading your first answers.</p>
            </div>
            <ol className="fk-help-track">
              {START.map((st, i) => (
                <li key={st.href}>
                  <Link href={st.href} className="fk-help-stop">
                    <span className="fk-help-art" aria-hidden>
                      <StartArt kind={st.art} />
                    </span>
                    <span className="fk-help-stop-n">{i + 1}</span>
                    <b>{st.title}</b>
                    <span>{st.line}</span>
                    <span className="fk-help-stop-go">
                      Read the guide <ArrowRight size={14} strokeWidth={2} aria-hidden />
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </section>

          <div className="fk-measure fk-help-grid">
            {HELP_CATEGORIES.map((cat, i) => (
              <Fragment key={cat.id}>
              {cat.group !== HELP_CATEGORIES[i - 1]?.group && <h2 className="fk-help-group">{cat.group}</h2>}
              <section id={cat.id} className="fk-help-cat" aria-labelledby={`c-${cat.id}`}>
                <div className="fk-help-cat-head">
                  <span className="fk-help-cat-tile">
                    <Glyph name={cat.icon} size={18} />
                  </span>
                  <h3
                    id={`c-${cat.id}`}
                    style={{ margin: 0, fontSize: 18, fontWeight: 500 }}
                  >
                    {cat.name}
                  </h3>
                  <span className="fk-help-cat-count">{cat.articles.length}</span>
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
                      <ArrowRight size={14} strokeWidth={2} aria-hidden />
                    </Link>
                  ))}
                </div>
              </section>
              </Fragment>
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
