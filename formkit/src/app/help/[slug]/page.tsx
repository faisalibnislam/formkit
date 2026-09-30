import type { Metadata } from "next";
import Link from "next/link";
import { HelpSearch } from "@/components/site/HelpSearch";
import { HelpCta } from "@/components/site/HelpCta";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { NightSky } from "@/components/brand/NightSky";
import { PublicPage } from "@/components/site/PublicPage";
import { HelpArticleBody } from "@/components/site/HelpArticleBody";
import { HelpFeedback } from "@/components/site/HelpFeedback";
import { JsonLd, article as articleData, breadcrumb } from "@/components/site/JsonLd";
import { SITE_DATES } from "@/lib/dates";
import { HELP_ARTICLES, HELP_CATEGORIES, helpArticle } from "@/content/help";
import { SITE_URL } from "@/lib/site";

export function generateStaticParams() {
  return HELP_ARTICLES.map((a) => ({ slug: a.id }));
}

export async function generateMetadata(
  props: PageProps<"/help/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const article = helpArticle(slug);
  if (!article) return {};
  return {
    title: article.title,
    description: article.summary,
    alternates: { canonical: `${SITE_URL}/help/${article.id}` },
    openGraph: {
      type: "article",
      siteName: "Formkit",
      url: `${SITE_URL}/help/${article.id}`,
      title: `${article.title} | Formkit help`,
      description: article.summary,
    },
  };
}

export default async function HelpArticlePage(props: PageProps<"/help/[slug]">) {
  const { slug } = await props.params;
  const article = helpArticle(slug);
  if (!article) notFound();

  const index = HELP_ARTICLES.findIndex((a) => a.id === article.id);
  const prev = index > 0 ? HELP_ARTICLES[index - 1] : null;
  const next = index < HELP_ARTICLES.length - 1 ? HELP_ARTICLES[index + 1] : null;
  const cat = article.category;

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            articleData({
              headline: article.title,
              description: article.summary,
              url: `${SITE_URL}/help/${article.id}`,
              updated: article.updated ?? SITE_DATES.help,
              section: cat.name,
            }),
            breadcrumb([
              { name: "Formkit", url: `${SITE_URL}/` },
              { name: "Help center", url: `${SITE_URL}/help` },
              { name: cat.name, url: `${SITE_URL}/help#${cat.id}` },
              { name: article.title, url: `${SITE_URL}/help/${article.id}` },
            ]),
            {
              "@type": "Article",
              headline: article.title,
              description: article.summary,
              articleSection: cat.name,
              url: `${SITE_URL}/help/${article.id}`,
              publisher: { "@type": "Organization", name: "Formkit" },
              inLanguage: "en-US",
            },
          ],
        }}
      />

      <PublicPage current="help">
        <section
          className="fk-hero"
          style={{
            padding:
              "calc(104px + clamp(20px,4vw,40px)) clamp(20px,5vw,56px) clamp(40px,5vw,60px)",
          }}
        >
          <NightSky />
          <div className="fk-hero-inner fk-measure">
            <nav aria-label="Breadcrumb" className="fk-crumbs">
              <Link href="/help">Help center</Link>
              <span>/</span>
              <span style={{ color: "#ffffff" }}>{cat.name}</span>
            </nav>
            <h1
              style={{
                margin: 0,
                maxWidth: "20ch",
                fontSize: "clamp(28px,4vw,48px)",
                fontWeight: 700,
                letterSpacing: "-.035em",
                lineHeight: 1.05,
                color: "#ffffff",
              }}
            >
              {article.title}
            </h1>
            <p
              style={{
                margin: "14px 0 0",
                maxWidth: "58ch",
                fontSize: 16.5,
                lineHeight: 1.6,
                color: "#ffffff",
                opacity: 0.86,
                textWrap: "pretty",
              }}
            >
              {article.summary}
            </p>
            <div className="fk-help-hero-search">
              <HelpSearch />
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
          <div className="fk-measure fk-help-article">
            <nav className="fk-help-side" aria-label={`${cat.name} articles`}>
              <span
                style={{
                  padding: "0 12px 8px",
                  fontSize: 11.5,
                  letterSpacing: ".14em",
                  color: "var(--color-text-tertiary)",
                }}
              >
                {cat.name.toUpperCase()}
              </span>
              {cat.articles.map((a) => (
                <Link
                  key={a.id}
                  href={`/help/${a.id}`}
                  aria-current={a.id === article.id ? "page" : undefined}
                >
                  {a.title}
                </Link>
              ))}

              <span
                style={{
                  padding: "20px 12px 8px",
                  fontSize: 11.5,
                  letterSpacing: ".14em",
                  color: "var(--color-text-tertiary)",
                }}
              >
                OTHER CATEGORIES
              </span>
              {HELP_CATEGORIES.filter((c) => c.id !== cat.id).map((c) => (
                <Link key={c.id} href={`/help/${c.articles[0]!.id}`}>
                  {c.name}
                </Link>
              ))}
            </nav>

            <div style={{ minWidth: 0 }}>
              <HelpArticleBody body={article.body} />

              <HelpFeedback articleId={article.id} />

              <div className="fk-help-prevnext">
                {prev ? (
                  <Link href={`/help/${prev.id}`} className="fk-help-step">
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 7,
                        fontSize: 12.5,
                        color: "var(--color-text-tertiary)",
                      }}
                    >
                      <ArrowLeft size={14} strokeWidth={1.8} aria-hidden />
                      Previous
                    </span>
                    <span
                      style={{
                        display: "block",
                        marginTop: 5,
                        fontSize: 15,
                        fontWeight: 500,
                      }}
                    >
                      {prev.title}
                    </span>
                  </Link>
                ) : (
                  <span />
                )}
                {next && (
                  <Link
                    href={`/help/${next.id}`}
                    className="fk-help-step"
                    style={{ textAlign: "right" }}
                  >
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 7,
                        fontSize: 12.5,
                        color: "var(--color-text-tertiary)",
                      }}
                    >
                      Next
                      <ArrowRight size={14} strokeWidth={1.8} aria-hidden />
                    </span>
                    <span
                      style={{
                        display: "block",
                        marginTop: 5,
                        fontSize: 15,
                        fontWeight: 500,
                      }}
                    >
                      {next.title}
                    </span>
                  </Link>
                )}
              </div>

              <HelpCta />
            </div>
          </div>
        </main>
      </PublicPage>
    </>
  );
}
