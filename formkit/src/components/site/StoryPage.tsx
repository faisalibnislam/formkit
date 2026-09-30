import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check } from "lucide-react";
import { NightSky } from "@/components/brand/NightSky";
import { Glyph } from "@/components/brand/Glyph";
import { PublicPage } from "@/components/site/PublicPage";
import { JsonLd, article, breadcrumb, faqPage } from "@/components/site/JsonLd";
import { FEATURE_PAGES, type Story } from "@/content/features";
import { templateBySlug } from "@/content/templates";
import { helpArticle } from "@/content/help";
import { SITE_URL } from "@/lib/site";

/**
 * One feature or use-case page: the hero, the sections, how to start, the
 * templates and help articles that go with it, related features, and the
 * questions people ask. The links between them are most of the point: they
 * are how visitors (and search engines) move from a feature to a template to
 * the help that explains it.
 */
export function StoryPage({ story, base, crumb }: { story: Story; base: "features" | "use-cases"; crumb: string }) {
  const url = `${SITE_URL}/${base}/${story.slug}`;
  const templates = story.templates.map(templateBySlug).filter((t) => t !== null);
  const help = story.help.map(helpArticle).filter((a) => a !== null);
  const related = story.related.map((s) => FEATURE_PAGES.find((f) => f.slug === s)).filter((f) => f !== undefined);

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            breadcrumb([
              { name: "Formkit", url: `${SITE_URL}/` },
              { name: crumb, url: `${SITE_URL}/${base}` },
              { name: story.name, url },
            ]),
            article({ headline: story.title, description: story.meta, url, updated: story.updated }),
            faqPage(story.faqs),
          ],
        }}
      />
      <PublicPage current="features">
        <section className="fk-hero fk-story-hero">
          <NightSky />
          <div className="fk-hero-inner fk-measure">
            <nav aria-label="Breadcrumb" className="fk-crumbs">
              <Link href="/">Formkit</Link>
              <span>/</span>
              <Link href={`/${base}`}>{crumb}</Link>
              <span>/</span>
              <span style={{ color: "#ffffff" }}>{story.name}</span>
            </nav>
            <span className="fk-story-kicker">
              <Glyph name={story.icon} size={15} /> {story.kicker}
            </span>
            <h1 className="fk-story-title">{story.title}</h1>
            <p className="fk-story-lead">{story.lead}</p>
            <div className="fk-story-ctas">
              <Link href="/signup" className="fk-pill fk-pill-light fk-pill-lg">
                Start free <ArrowRight size={17} strokeWidth={1.8} aria-hidden />
              </Link>
              <span className="fk-story-plan">{story.plan}</span>
            </div>
          </div>
        </section>

        <main id="fk-main" className="fk-main fk-story-main">
          <div className="fk-measure">
            <div className="fk-story-sections">
              {story.sections.map((s) => (
                <section key={s.title} className="fk-story-section">
                  <h2>{s.title}</h2>
                  <p>{s.body}</p>
                  {s.points && (
                    <ul>
                      {s.points.map((p) => (
                        <li key={p}>
                          <Check size={15} strokeWidth={2.2} aria-hidden /> {p}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ))}
            </div>

            {story.steps && (
              <section className="fk-story-block">
                <h2 className="fk-story-h2">How to start</h2>
                <ol className="fk-story-steps">
                  {story.steps.map((s, i) => (
                    <li key={s}>
                      <span>{i + 1}</span>
                      {s}
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {templates.length > 0 && (
              <section className="fk-story-block">
                <h2 className="fk-story-h2">Templates to start from</h2>
                <div className="fk-tpl-grid">
                  {templates.map((t) => (
                    <Link key={t.slug} href={`/templates/${t.slug}`} className="fk-tpl-card">
                      <span className="fk-tpl-tile">
                        <Glyph name={t.icon} size={20} />
                      </span>
                      <span className="fk-tpl-name">{t.name}</span>
                      <span className="fk-tpl-blurb">{t.blurb}</span>
                      <span className="fk-tpl-more">
                        See the questions <ArrowRight size={15} strokeWidth={1.8} aria-hidden />
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            <div className="fk-story-two">
              {help.length > 0 && (
                <section>
                  <h2 className="fk-story-h2">In the help centre</h2>
                  <ul className="fk-story-links">
                    {help.map((a) => (
                      <li key={a.id}>
                        <Link href={`/help/${a.id}`}>
                          {a.title}
                          <span>{a.summary}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {related.length > 0 && (
                <section>
                  <h2 className="fk-story-h2">Goes well with</h2>
                  <ul className="fk-story-links">
                    {related.map((f) => (
                      <li key={f.slug}>
                        <Link href={`/features/${f.slug}`}>
                          {f.name}
                          <span>{f.meta}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>

            <section className="fk-story-block">
              <h2 className="fk-story-h2">Questions</h2>
              <div className="fk-story-faq">
                {story.faqs.map((f) => (
                  <details key={f.q} className="fk-price-q">
                    <summary>{f.q}</summary>
                    <p>{f.a}</p>
                  </details>
                ))}
              </div>
            </section>

            <section className="fk-story-final">
              <h2>Try it on your next form.</h2>
              <p>Free to start, with unlimited forms, responses and members. See what each plan includes on the pricing page.</p>
              <div className="fk-story-ctas">
                <Link href="/signup" className="fk-pill fk-pill-dark fk-pill-lg">
                  Start free <ArrowRight size={17} strokeWidth={1.8} aria-hidden />
                </Link>
                <Link href="/pricing" className="fk-pill fk-pill-light fk-pill-lg">
                  See pricing <ArrowUpRight size={16} strokeWidth={1.8} aria-hidden />
                </Link>
              </div>
            </section>
          </div>
        </main>
      </PublicPage>
    </>
  );
}

/** The index of feature or use-case pages: a card for each. */
export function StoryIndex({
  stories,
  base,
  title,
  lead,
  crumb,
  children,
}: {
  stories: Story[];
  base: "features" | "use-cases";
  title: string;
  lead: string;
  crumb: string;
  children?: React.ReactNode;
}) {
  return (
    <PublicPage current="features">
      <section className="fk-hero fk-story-hero">
        <NightSky />
        <div className="fk-hero-inner fk-measure">
          <nav aria-label="Breadcrumb" className="fk-crumbs">
            <Link href="/">Formkit</Link>
            <span>/</span>
            <span style={{ color: "#ffffff" }}>{crumb}</span>
          </nav>
          <h1 className="fk-story-title">{title}</h1>
          <p className="fk-story-lead">{lead}</p>
        </div>
      </section>
      <main id="fk-main" className="fk-main fk-story-main">
        <div className="fk-measure">
          <div className="fk-story-cards">
            {stories.map((s) => (
              <Link key={s.slug} href={`/${base}/${s.slug}`} className="fk-story-card">
                <span className="fk-tpl-tile">
                  <Glyph name={s.icon} size={20} />
                </span>
                <b>{s.name}</b>
                <span className="fk-story-card-lead">{s.lead}</span>
                <span className="fk-story-card-plan">{s.plan}</span>
              </Link>
            ))}
          </div>
          {children}
        </div>
      </main>
    </PublicPage>
  );
}
