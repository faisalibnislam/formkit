import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, ArrowUpRight, Check } from "lucide-react";
import { NightSky } from "@/components/brand/NightSky";
import { Glyph } from "@/components/brand/Glyph";
import { PublicPage } from "@/components/site/PublicPage";
import { Reveal } from "@/components/site/Reveal";
import { StoryScene } from "@/components/site/scenes";
import { SceneCard } from "@/components/site/SceneCard";
import { JsonLd, article, breadcrumb, faqPage } from "@/components/site/JsonLd";
import { FEATURE_PAGES, type Story } from "@/content/features";
import { templateBySlug } from "@/content/templates";
import { helpArticle } from "@/content/help";
import { SITE_URL } from "@/lib/site";

/**
 * One feature or use-case page: a hero with the feature playing beside it,
 * what it does, how to start, the templates and help that go with it,
 * related features (playing too), and the questions people ask. The links
 * between them are most of the point: they are how visitors, and search
 * engines, move from a feature to a template to the help that explains it.
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
          <div className="fk-hero-inner fk-story-hero-grid">
            <div className="fk-story-hero-copy">
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
            <div className="fk-story-hero-scene">
              <StoryScene slug={story.slug} hint />
            </div>
          </div>
        </section>

        <main id="fk-main" className="fk-main fk-story-main">
          <Reveal className="fk-measure">
            <h2 className="fk-story-h2" data-rise>
              What it does
            </h2>
            <div className="fk-story-sections" data-count={story.sections.length}>
              {story.sections.map((s, i) => (
                <section key={s.title} className="fk-story-section" data-rise style={{ transitionDelay: `${i * 80}ms` }}>
                  <span className="fk-story-num">{String(i + 1).padStart(2, "0")}</span>
                  <h3>{s.title}</h3>
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
              <section className="fk-story-block" data-rise>
                <h2 className="fk-story-h2">How to start</h2>
                <ol className="fk-story-steps">
                  {story.steps.map((s, i) => (
                    <li key={s} style={{ transitionDelay: `${i * 120}ms` }}>
                      <span>{i + 1}</span>
                      {s}
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {templates.length > 0 && (
              <section className="fk-story-block" data-rise>
                <div className="fk-story-blockhead">
                  <h2 className="fk-story-h2">Templates to start from</h2>
                  <Link href="/templates" className="fk-story-more">
                    Every template <ArrowRight size={15} strokeWidth={1.8} aria-hidden />
                  </Link>
                </div>
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

            {related.length > 0 && (
              <section className="fk-story-block" data-rise>
                <h2 className="fk-story-h2">Goes well with</h2>
                <div className="fk-story-related">
                  {related.map((f) => (
                    <SceneCard key={f.slug} story={f} base="features" />
                  ))}
                </div>
              </section>
            )}

            {help.length > 0 && (
              <section className="fk-story-block" data-rise>
                <h2 className="fk-story-h2">In the help centre</h2>
                <ul className="fk-story-links fk-story-links-grid">
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

            <section className="fk-story-block" data-rise>
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

            <FinalCta />
          </Reveal>
        </main>
      </PublicPage>
    </>
  );
}

function FinalCta() {
  return (
    <section className="fk-story-final" data-rise>
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
  );
}

/**
 * The index of feature or use-case pages: an optional showcase first, then
 * every page as a card with its scene playing.
 */
export function StoryIndex({
  stories,
  base,
  title,
  lead,
  crumb,
  showcase,
  children,
}: {
  stories: Story[];
  base: "features" | "use-cases";
  title: string;
  lead: string;
  crumb: string;
  showcase?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <PublicPage current="features">
      <section className="fk-hero fk-story-hero fk-story-hero-index">
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
        <Reveal className="fk-measure">
          {showcase && <div data-rise>{showcase}</div>}
          <section className={showcase ? "fk-story-block" : undefined} data-rise>
            {showcase && <h2 className="fk-story-h2">Every feature, playing</h2>}
            <div className="fk-bento">
              {stories.map((s, i) => (
                <SceneCard key={s.slug} story={s} base={base} wide={i % 4 === 0 || i % 4 === 3} />
              ))}
            </div>
          </section>
          {children}
          <FinalCta />
        </Reveal>
      </main>
    </PublicPage>
  );
}
