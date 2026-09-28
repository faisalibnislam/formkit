import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { NightSky } from "@/components/brand/NightSky";
import { Glyph } from "@/components/brand/Glyph";
import { PublicPage } from "@/components/site/PublicPage";
import { JsonLd, breadcrumb, faqPage } from "@/components/site/JsonLd";
import { TEMPLATES, templateBySlug } from "@/content/templates";
import { SHARE_IMAGE, SITE_URL } from "@/lib/site";

export function generateStaticParams() {
  return TEMPLATES.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata(
  props: PageProps<"/templates/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const t = templateBySlug(slug);
  if (!t) return {};
  const title = `${t.name} form template`;
  return {
    title,
    description: t.meta,
    alternates: { canonical: `${SITE_URL}/templates/${t.slug}` },
    openGraph: {
      images: [SHARE_IMAGE],
      type: "article",
      siteName: "Formkit",
      url: `${SITE_URL}/templates/${t.slug}`,
      title: `${title} | Formkit`,
      description: t.meta,
    },
    twitter: { card: "summary_large_image", images: [SHARE_IMAGE], title, description: t.meta },
  };
}

export default async function TemplateDetailPage(props: PageProps<"/templates/[slug]">) {
  const { slug } = await props.params;
  const t = templateBySlug(slug);
  if (!t) notFound();

  const others = TEMPLATES.filter((x) => x.slug !== t.slug);

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
              {t.name} form template
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
          </div>
        </section>

        <main
          id="fk-main"
          className="fk-main"
          style={{
            padding: "clamp(34px,5vw,64px) clamp(20px,5vw,56px) clamp(44px,6vw,72px)",
          }}
        >
          <div className="fk-measure fk-tpl-detail">
            <div style={{ minWidth: 0 }}>
              <p
                style={{
                  margin: 0,
                  maxWidth: "64ch",
                  fontSize: 17,
                  lineHeight: 1.65,
                  color: "var(--color-text-secondary)",
                  textWrap: "pretty",
                }}
              >
                {t.lead}
              </p>

              <h2
                style={{
                  margin: "clamp(30px,4vw,48px) 0 0",
                  fontSize: "clamp(20px,2.2vw,28px)",
                  fontWeight: 600,
                  letterSpacing: "-.02em",
                }}
              >
                Every question in this template
              </h2>
              <div style={{ marginTop: 10 }}>
                {t.questions.map((question, i) => (
                  <div key={question.title} className="fk-tpl-qrow">
                    <span className="fk-tpl-qindex">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="fk-tpl-qglyph">
                      <Glyph name={question.icon} size={15} />
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span
                        style={{
                          display: "block",
                          fontSize: 15.5,
                          fontWeight: 500,
                          color: "var(--neutral-900)",
                        }}
                      >
                        {question.title}
                      </span>
                      <span
                        style={{
                          display: "block",
                          marginTop: 2,
                          fontSize: 13,
                          color: "var(--color-text-tertiary)",
                        }}
                      >
                        {question.type}
                      </span>
                    </span>
                  </div>
                ))}
              </div>

              <h2
                style={{
                  margin: "clamp(30px,4vw,48px) 0 0",
                  fontSize: "clamp(20px,2.2vw,28px)",
                  fontWeight: 600,
                  letterSpacing: "-.02em",
                }}
              >
                Who this template is for
              </h2>
              {t.who.map((para) => (
                <p
                  key={para.slice(0, 40)}
                  style={{
                    margin: "12px 0 0",
                    maxWidth: "66ch",
                    fontSize: 15.5,
                    lineHeight: 1.65,
                    color: "var(--color-text-secondary)",
                    textWrap: "pretty",
                  }}
                >
                  {para}
                </p>
              ))}

              <h2
                style={{
                  margin: "clamp(30px,4vw,48px) 0 0",
                  fontSize: "clamp(20px,2.2vw,28px)",
                  fontWeight: 600,
                  letterSpacing: "-.02em",
                }}
              >
                How Formkit templates work
              </h2>
              <ol className="fk-tpl-how">
                <li>
                  <strong>Use this template</strong> makes a copy in your account. It is yours to change, and nothing you
                  do touches the original.
                </li>
                <li>
                  <strong>Change anything.</strong> Reword the questions, add or remove them, change the logic and the
                  theme. It is an ordinary form from here on.
                </li>
                <li>
                  <strong>Publish when it reads right.</strong> It goes out under your own link, and the answers land
                  in your inbox.
                </li>
              </ol>

              <h2
                style={{
                  margin: "clamp(30px,4vw,48px) 0 0",
                  fontSize: "clamp(20px,2.2vw,28px)",
                  fontWeight: 600,
                  letterSpacing: "-.02em",
                }}
              >
                Questions about this template
              </h2>
              <div style={{ maxWidth: "70ch", marginTop: 8 }}>
                {t.faqs.map((f) => (
                  <div
                    key={f.q}
                    style={{
                      padding: "18px 0",
                      boxShadow: "inset 0 1px 0 var(--neutral-200)",
                    }}
                  >
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 500 }}>{f.q}</h3>
                    <p
                      style={{
                        margin: "8px 0 0",
                        fontSize: 15,
                        lineHeight: 1.6,
                        color: "var(--color-text-secondary)",
                        textWrap: "pretty",
                      }}
                    >
                      {f.a}
                    </p>
                  </div>
                ))}
              </div>

              <h2
                style={{
                  margin: "clamp(30px,4vw,48px) 0 0",
                  fontSize: "clamp(20px,2.2vw,28px)",
                  fontWeight: 600,
                  letterSpacing: "-.02em",
                }}
              >
                Other templates
              </h2>
              <div
                style={{
                  display: "flex",
                  gap: 9,
                  flexWrap: "wrap",
                  marginTop: 14,
                }}
              >
                {others.map((o) => (
                  <Link key={o.slug} href={`/templates/${o.slug}`} className="fk-chip">
                    <Glyph name={o.icon} size={15} />
                    {o.name}
                  </Link>
                ))}
              </div>
            </div>

            <aside className="fk-tpl-aside" aria-label="At a glance">
              <span
                style={{
                  fontSize: 11.5,
                  letterSpacing: ".14em",
                  color: "var(--color-text-tertiary)",
                }}
              >
                AT A GLANCE
              </span>
              <dl style={{ margin: "14px 0 0", display: "grid", gap: 12 }}>
                <Fact label="Questions" value={String(t.questions.length)} />
                <Fact label="Pages" value={t.pages} />
                <Fact label="Time to finish" value={t.time} />
                <Fact
                  label="Conditional logic"
                  value={t.logic ? "Included" : "Not needed"}
                />
                <Fact label="Price" value="Free" />
              </dl>
              <Link
                href={`/signup?template=${t.slug}`}
                className="fk-pill fk-pill-dark fk-pill-md"
                style={{ width: "100%", justifyContent: "center", marginTop: 18 }}
              >
                Use this template
              </Link>
            </aside>
          </div>
        </main>
      </PublicPage>
    </>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <dt style={{ fontSize: 14, color: "var(--color-text-secondary)" }}>{label}</dt>
      <dd style={{ margin: 0, fontSize: 15, fontWeight: 500 }}>{value}</dd>
    </div>
  );
}
