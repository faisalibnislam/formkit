import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { NightSky } from "@/components/brand/NightSky";
import { PublicPage } from "@/components/site/PublicPage";
import { CompareTable } from "@/components/site/CompareTable";
import { JsonLd, breadcrumb, faqPage } from "@/components/site/JsonLd";
import { COMPARE_ASOF, RIVALS, rivalBySlug } from "@/content/compare";
import { SITE_URL } from "@/lib/site";

export function generateStaticParams() {
  return RIVALS.map((r) => ({ slug: r.slug }));
}

export async function generateMetadata(
  props: PageProps<"/compare/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const r = rivalBySlug(slug);
  if (!r) return {};
  const title = `Formkit vs ${r.name}: an honest comparison`;
  return {
    title,
    description: r.meta,
    alternates: { canonical: `${SITE_URL}/compare/${r.slug}` },
    openGraph: {
      type: "article",
      siteName: "Formkit",
      url: `${SITE_URL}/compare/${r.slug}`,
      title,
      description: r.meta,
    },
    twitter: { card: "summary_large_image", title, description: r.meta },
  };
}

export default async function CompareDetailPage(props: PageProps<"/compare/[slug]">) {
  const { slug } = await props.params;
  const r = rivalBySlug(slug);
  if (!r) notFound();

  const other = RIVALS.find((x) => x.slug !== r.slug)!;

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            breadcrumb([
              { name: "Formkit", url: `${SITE_URL}/` },
              { name: "Compare", url: `${SITE_URL}/compare` },
              { name: `Formkit vs ${r.name}`, url: `${SITE_URL}/compare/${r.slug}` },
            ]),
            faqPage(r.faqs),
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
              <Link href="/compare">Compare</Link>
              <span>/</span>
              <span style={{ color: "#ffffff" }}>Formkit vs {r.name}</span>
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
              Formkit vs {r.name}
            </h1>
            <p
              style={{
                margin: "16px 0 0",
                maxWidth: "60ch",
                fontSize: 17,
                lineHeight: 1.6,
                color: "#ffffff",
                opacity: 0.88,
                textWrap: "pretty",
              }}
            >
              {r.meta}
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
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(min(300px,100%),1fr))",
                gap: 18,
              }}
            >
              <div className="fk-pick">
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
                  Pick {r.name} when
                </h2>
                <p
                  style={{
                    margin: "8px 0 0",
                    fontSize: 15,
                    lineHeight: 1.6,
                    color: "var(--color-text-secondary)",
                    textWrap: "pretty",
                  }}
                >
                  {r.when}
                </p>
                <p
                  style={{
                    margin: "12px 0 0",
                    fontSize: 14.5,
                    lineHeight: 1.6,
                    color: "var(--color-text-tertiary)",
                    textWrap: "pretty",
                  }}
                >
                  {r.line}
                </p>
              </div>
              <div className="fk-pick" data-ours="true">
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
                  Pick Formkit when
                </h2>
                <p
                  style={{
                    margin: "8px 0 0",
                    fontSize: 15,
                    lineHeight: 1.6,
                    color: "var(--color-text-secondary)",
                    textWrap: "pretty",
                  }}
                >
                  {r.ourWhen}
                </p>
                <p
                  style={{
                    margin: "12px 0 0",
                    fontSize: 14.5,
                    lineHeight: 1.6,
                    color: "var(--color-text-tertiary)",
                    textWrap: "pretty",
                  }}
                >
                  A complete workspace for designing the form, shaping the journey, and
                  using what comes back. Free to start.
                </p>
              </div>
            </div>

            <h2
              style={{
                margin: "clamp(36px,5vw,64px) 0 0",
                fontSize: "clamp(22px,2.8vw,34px)",
                fontWeight: 700,
                letterSpacing: "-.03em",
              }}
            >
              Feature by feature
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

            <CompareTable columns={[r.column, 2]} />

            <h2
              style={{
                margin: "clamp(36px,5vw,64px) 0 0",
                fontSize: "clamp(22px,2.8vw,34px)",
                fontWeight: 700,
                letterSpacing: "-.03em",
              }}
            >
              Questions people ask
            </h2>
            <div style={{ maxWidth: "70ch", marginTop: 8 }}>
              {r.faqs.map((f) => (
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

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                flexWrap: "wrap",
                marginTop: "clamp(36px,5vw,64px)",
                padding: 26,
                borderRadius: "var(--radius-card)",
                background: "var(--blue-50)",
              }}
            >
              <span
                style={{
                  flex: 1,
                  minWidth: 220,
                  maxWidth: "44ch",
                  fontSize: 17,
                  lineHeight: 1.5,
                  fontWeight: 500,
                }}
              >
                Choose the tool that fits the job. Choose Formkit when the form is part of
                how people see you.
              </span>
              <Link href="/signup" className="fk-pill fk-pill-dark fk-pill-md">
                Build a form
                <ArrowRight size={16} strokeWidth={1.8} aria-hidden />
              </Link>
            </div>

            <p style={{ marginTop: 26, fontSize: 14.5 }}>
              <Link href={`/compare/${other.slug}`}>
                Read Formkit vs {other.name} instead
              </Link>
            </p>
          </div>
        </main>
      </PublicPage>
    </>
  );
}
