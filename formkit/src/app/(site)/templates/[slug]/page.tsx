import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Check, Plus } from "lucide-react";
import { NightSky } from "@/components/brand/NightSky";
import { Glyph } from "@/components/brand/Glyph";
import { PublicPage } from "@/components/site/PublicPage";
import { JsonLd, breadcrumb, faqPage } from "@/components/site/JsonLd";
import { TEMPLATES, templateBySlug, templateTitle } from "@/content/templates";
import { featureBySlug } from "@/content/features";
import { templatePreview } from "@/content/templatePreview";
import { TemplatePreviewProvider, TemplatePreviewer } from "@/components/templates/TemplatePreviewer";
import { TemplateFlow, TemplateResponse, TemplateSteps } from "@/components/templates/TemplateParts";
import { TemplateCard } from "@/components/templates/TemplateBrowser";
import { templateCard } from "@/content/templateCards";
import { SceneCard } from "@/components/site/SceneCard";
import { Reveal } from "@/components/site/Reveal";
import { SITE_URL } from "@/lib/site";

export function generateStaticParams() {
  return TEMPLATES.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata(
  props: PageProps<"/templates/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const t = templateBySlug(slug);
  if (!t) return {};
  const title = templateTitle(t);
  return {
    title,
    description: t.meta,
    alternates: { canonical: `${SITE_URL}/templates/${t.slug}` },
    openGraph: {
      type: "article",
      siteName: "Formkit",
      url: `${SITE_URL}/templates/${t.slug}`,
      title: `${title} | Formkit`,
      description: t.meta,
    },
    twitter: { card: "summary_large_image", title, description: t.meta },
  };
}

export default async function TemplateDetailPage(props: PageProps<"/templates/[slug]">) {
  const { slug } = await props.params;
  const t = templateBySlug(slug);
  if (!t) notFound();

  // Neighbours from the same category first, then a few from elsewhere.
  const others = [
    ...TEMPLATES.filter((x) => x.slug !== t.slug && x.category === t.category),
    ...TEMPLATES.filter((x) => x.slug !== t.slug && x.category !== t.category),
  ].slice(0, 8);
  const features = (t.features ?? []).map(featureBySlug).filter((f) => f !== null);
  const preview = templatePreview(t.slug);

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            breadcrumb([
              { name: "Formkit", url: `${SITE_URL}/` },
              { name: "Templates", url: `${SITE_URL}/templates` },
              { name: t.name, url: `${SITE_URL}/templates/${t.slug}` },
            ]),
            {
              "@type": "HowTo",
              name: `How to use the ${t.name.toLowerCase()} template`,
              description: t.meta,
              totalTime: "PT2M",
              step: [
                {
                  "@type": "HowToStep",
                  name: "Use the template",
                  text: "Open the template in Formkit. It becomes your own draft. Nothing stays linked to the original.",
                },
                {
                  "@type": "HowToStep",
                  name: "Change the questions",
                  text: "Rewrite the wording, drop what you do not need, add a page, and set your own theme and logo.",
                },
                {
                  "@type": "HowToStep",
                  name: "Publish it",
                  text: "Publish under your own handle and share the link, a QR code or an embed.",
                },
              ],
            },
            faqPage(t.faqs),
          ],
        }}
      />

      <TemplatePreviewProvider>
      <PublicPage current="templates">
        <section
          className="fk-hero"
          style={{
            padding:
              "calc(104px + clamp(20px,4vw,44px)) clamp(20px,5vw,56px) clamp(48px,6vw,72px)",
          }}
        >
          <NightSky />
          <div className="fk-hero-inner fk-tpl-hero">
            <div className="fk-tpl-hero-copy">
            <nav aria-label="Breadcrumb" className="fk-crumbs">
              <Link href="/">Formkit</Link>
              <span>/</span>
              <Link href="/templates">Templates</Link>
              <span>/</span>
              <span style={{ color: "#ffffff" }}>{t.name}</span>
            </nav>
            <h1
              style={{
                margin: 0,
                maxWidth: "18ch",
                fontSize: "clamp(30px,4.6vw,56px)",
                fontWeight: 700,
                letterSpacing: "-.04em",
                lineHeight: 1.02,
                color: "#ffffff",
              }}
            >
              {templateTitle(t)}
            </h1>
            <p
              style={{
                margin: "16px 0 0",
                maxWidth: "58ch",
                fontSize: 17,
                lineHeight: 1.6,
                color: "#ffffff",
                opacity: 0.88,
                textWrap: "pretty",
              }}
            >
              {t.blurb}
            </p>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                flexWrap: "wrap",
                marginTop: 28,
              }}
            >
              <Link
                href={`/signup?template=${t.slug}`}
                className="fk-pill fk-pill-light fk-pill-lg"
              >
                Use this template
                <ArrowRight size={17} strokeWidth={1.8} aria-hidden />
              </Link>
              <span style={{ fontSize: 14.5, color: "rgba(255,255,255,.78)" }}>
                Free · no credit card
              </span>
            </div>
            <ul className="fk-tpl-facts">
              <li>
                <b>{t.questions.length}</b> questions
              </li>
              <li>
                <b>{t.pages}</b> {t.pages === "1" ? "page" : "pages"}
              </li>
              <li>
                <b>{t.time}</b> to fill in
              </li>
              {t.category && (
                <li>
                  <b>{t.category}</b>
                </li>
              )}
            </ul>
            </div>
            {preview && (
              <div className="fk-tpl-hero-preview">
                <TemplatePreviewer preview={preview} slug={t.slug} name={t.name} />
                <p className="fk-tpl-hero-hint">This is the real template. Fill it in, then make it yours.</p>
              </div>
            )}
          </div>
        </section>

        <main id="fk-main" className="fk-main fk-tpd">
          <Reveal className="fk-measure">
            <div className="fk-tpd-intro" data-rise>
              <div>
                <p className="fk-tpd-lead">{t.lead}</p>
                <div className="fk-tpd-who">
                  <span className="fk-more-kicker">Who it&rsquo;s for</span>
                  {t.who.map((para) => (
                    <p key={para.slice(0, 40)}>{para}</p>
                  ))}
                </div>
              </div>
              <aside className="fk-tpd-glance" aria-label="At a glance">
                <span className="fk-tpd-glance-icon" style={{ ["--accent" as string]: preview?.accent ?? "var(--blue-200)" }}>
                  <Glyph name={t.icon} size={22} />
                </span>
                <dl>
                  <Fact label="Questions" value={String(t.questions.length)} />
                  <Fact label="Pages" value={t.pages} />
                  <Fact label="Time to finish" value={t.time} />
                  <Fact label="Conditional logic" value={t.logic ? "Included" : "Not needed"} />
                  <Fact label="Price" value="Free" />
                </dl>
                <Link
                  href={`/signup?template=${t.slug}`}
                  className="fk-pill fk-pill-dark fk-pill-md"
                  style={{ width: "100%", justifyContent: "center" }}
                >
                  Use this template <ArrowRight size={16} strokeWidth={1.8} aria-hidden />
                </Link>
              </aside>
            </div>

            {preview && (
              <section className="fk-tpd-sec" data-rise aria-labelledby="tpd-flow">
                <span className="fk-more-kicker">Page by page</span>
                <h2 id="tpd-flow" className="fk-tpd-h2">
                  Every question in this template
                </h2>
                <p className="fk-tpd-lede">
                  The pages as a respondent meets them. Pick any question to open it in the live
                  preview above.
                </p>
                <TemplateFlow t={t} preview={preview} />
              </section>
            )}

            {preview && (
              <section className="fk-tpd-sec fk-tpd-back" data-rise aria-labelledby="tpd-back">
                <div className="fk-tpd-back-copy">
                  <span className="fk-more-kicker">What comes back</span>
                  <h2 id="tpd-back" className="fk-tpd-h2">
                    Every answer, in one place
                  </h2>
                  <p className="fk-tpd-lede">
                    Each response lands in your inbox as a card like this one, with an email to you
                    if you want it. People who stop part-way are kept too, with the answers they gave.
                  </p>
                  <ul className="fk-tpd-checks">
                    <li>
                      <Check size={15} strokeWidth={2.4} aria-hidden /> Partial answers and drop-off by question, on every plan
                    </li>
                    <li>
                      <Check size={15} strokeWidth={2.4} aria-hidden /> Export to CSV on every plan, Excel on Pro
                    </li>
                    <li>
                      <Check size={15} strokeWidth={2.4} aria-hidden /> Sheets, Slack, Zapier, Make and webhooks on Pro
                    </li>
                  </ul>
                </div>
                <TemplateResponse t={t} preview={preview} />
              </section>
            )}

            <section className="fk-tpd-sec" data-rise aria-labelledby="tpd-steps">
              <span className="fk-more-kicker">From template to live form</span>
              <h2 id="tpd-steps" className="fk-tpd-h2">
                Three steps, a couple of minutes
              </h2>
              <TemplateSteps slug={t.slug} />
            </section>

            {features.length > 0 && (
              <section className="fk-tpd-sec" data-rise aria-labelledby="tpd-more">
                <span className="fk-more-kicker">Make more of it</span>
                <h2 id="tpd-more" className="fk-tpd-h2">
                  What this form can also do
                </h2>
                <div className="fk-tpd-feats">
                  {features.slice(0, 3).map((f) => (
                    <SceneCard key={f.slug} story={f} base="features" />
                  ))}
                </div>
              </section>
            )}

            <section className="fk-tpd-sec" data-rise aria-labelledby="tpd-faq">
              <h2 id="tpd-faq" className="fk-tpd-h2">
                Questions about this template
              </h2>
              <div className="fk-cmp-faq">
                {t.faqs.map((f, k) => (
                  <details key={f.q} open={k === 0}>
                    <summary>
                      {f.q}
                      <Plus size={18} strokeWidth={2} aria-hidden />
                    </summary>
                    <p>{f.a}</p>
                  </details>
                ))}
              </div>
            </section>

            <section className="fk-tpd-sec" data-rise aria-labelledby="tpd-others">
              <div className="fk-tpd-others-head">
                <h2 id="tpd-others" className="fk-tpd-h2">
                  {t.category ? `More ${t.category.toLowerCase()} templates` : "Other templates"}
                </h2>
                <Link href="/templates" className="fk-tpd-all">
                  All {TEMPLATES.length} templates <ArrowRight size={15} strokeWidth={2} aria-hidden />
                </Link>
              </div>
              <div className="fk-tb-grid">
                {others.slice(0, 4).map((o) => (
                  <TemplateCard key={o.slug} t={templateCard(o)} />
                ))}
              </div>
            </section>
          </Reveal>
        </main>
      </PublicPage>
      </TemplatePreviewProvider>
    </>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
