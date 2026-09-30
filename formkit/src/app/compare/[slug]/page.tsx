import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CalendarCheck, FileCheck, Plus } from "lucide-react";
import { NightSky } from "@/components/brand/NightSky";
import { PublicPage } from "@/components/site/PublicPage";
import { CompareTable } from "@/components/site/CompareTable";
import { JsonLd, breadcrumb, faqPage } from "@/components/site/JsonLd";
import { COMPARE_ASOF, COMPARE_ROWS, RIVALS, rivalBySlug } from "@/content/compare";
import { Reveal } from "@/components/site/Reveal";
import { Beyond } from "@/components/compare/Beyond";
import { RivalCard } from "@/components/compare/RivalCard";
import { Logo } from "@/components/brand/Logo";
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

  const i = RIVALS.indexOf(r);
  const more = [1, 2, 3].map((k) => RIVALS[(i + k) % RIVALS.length]!);
  const rowCount = r.rows?.length ?? COMPARE_ROWS.length;

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
            <h1 className="fk-cmp-h1">Formkit vs {r.name}</h1>
            <p className="fk-cmp-hero-p">{r.meta}</p>
            <ul className="fk-cmp-facts">
              <li>
                <b>{rowCount}</b> things compared
              </li>
              <li>
                <FileCheck size={15} strokeWidth={2} aria-hidden /> Free plans, unless a row says otherwise
              </li>
              <li>
                <CalendarCheck size={15} strokeWidth={2} aria-hidden /> Checked {COMPARE_ASOF}
              </li>
            </ul>
          </div>
        </section>

        <main
          id="fk-main"
          className="fk-main"
          style={{
            padding: "clamp(34px,5vw,64px) clamp(20px,5vw,56px) clamp(44px,6vw,72px)",
          }}
        >
          <Reveal className="fk-measure">
            <div className="fk-vs" data-rise>
              <div className="fk-vs-side">
                <span className="fk-vs-mono" aria-hidden>
                  {r.name
                    .split(" ")
                    .map((w) => w[0])
                    .join("")
                    .slice(0, 2)}
                </span>
                <h2>Pick {r.name} when</h2>
                <p>{r.when}</p>
                <p className="fk-vs-line">{r.line}</p>
              </div>
              <span className="fk-vs-badge" aria-hidden>
                vs
              </span>
              <div className="fk-vs-side" data-ours>
                <span className="fk-vs-mono" aria-hidden>
                  <Logo size={18} wordmark={false} tone="inverse" />
                </span>
                <h2>Pick Formkit when</h2>
                <p>{r.ourWhen}</p>
                <p className="fk-vs-line">
                  A complete workspace for designing the form, shaping the journey, and
                  using what comes back. Free to start.
                </p>
              </div>
            </div>

            <section className="fk-cmp-sec" data-rise aria-labelledby="cmp-rows">
              <h2 id="cmp-rows" className="fk-cmp-h2">
                Feature by feature
              </h2>
              <p className="fk-cmp-lede">
                Based on each product&rsquo;s published pricing page, {COMPARE_ASOF}, and
                the free plan unless a row says otherwise. A dash means the feature exists
                but is narrower. Plans change, so check theirs before you decide.
              </p>
              <CompareTable rival={r} />
            </section>

            <section className="fk-cmp-sec" data-rise aria-labelledby="cmp-beyond">
              <span className="fk-more-kicker">Try it here</span>
              <h2 id="cmp-beyond" className="fk-cmp-h2">
                What a table can&rsquo;t show
              </h2>
              <p className="fk-cmp-lede">
                A tick says a feature exists. These show how it works in Formkit.
              </p>
              <Beyond />
            </section>

            <section className="fk-cmp-sec" data-rise aria-labelledby="cmp-faq">
              <h2 id="cmp-faq" className="fk-cmp-h2">
                Questions people ask
              </h2>
              <div className="fk-cmp-faq">
                {r.faqs.map((f, k) => (
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

            <div className="fk-cmp-close" data-rise>
              <p>
                Choose the tool that fits the job. Choose Formkit when the form is part of
                how people see you.
              </p>
              <Link href="/signup" className="fk-pill fk-pill-dark fk-pill-md">
                Build a form <ArrowRight size={16} strokeWidth={1.8} aria-hidden />
              </Link>
            </div>

            <section className="fk-cmp-sec" data-rise aria-labelledby="cmp-more">
              <h2 id="cmp-more" className="fk-cmp-h2">
                More comparisons
              </h2>
              <div className="fk-rc-grid">
                {more.map((x) => (
                  <RivalCard key={x.slug} r={x} />
                ))}
              </div>
              <p className="fk-cmp-all">
                <Link href="/compare">
                  All comparisons <ArrowRight size={15} strokeWidth={2} aria-hidden />
                </Link>
              </p>
            </section>
          </Reveal>
        </main>
      </PublicPage>
    </>
  );
}
