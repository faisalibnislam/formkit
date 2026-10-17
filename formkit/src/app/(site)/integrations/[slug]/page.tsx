import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StoryPage } from "@/components/site/StoryPage";
import { INTEGRATION_PAGES, integrationBySlug } from "@/content/integrations";
import { SITE_URL } from "@/lib/site";

export function generateStaticParams() {
  return INTEGRATION_PAGES.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata(props: PageProps<"/integrations/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const p = integrationBySlug(slug);
  if (!p) return {};
  const url = `${SITE_URL}/integrations/${p.slug}`;
  return {
    title: p.seo,
    description: p.meta,
    alternates: { canonical: url },
    openGraph: { type: "article", siteName: "Formkit", url, title: `${p.seo} | Formkit`, description: p.meta },
    twitter: { card: "summary_large_image", title: `${p.seo} | Formkit`, description: p.meta },
  };
}

export default async function IntegrationPage(props: PageProps<"/integrations/[slug]">) {
  const { slug } = await props.params;
  const p = integrationBySlug(slug);
  if (!p) notFound();
  return <StoryPage story={p} base="integrations" crumb="Integrations" />;
}
