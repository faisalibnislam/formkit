import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StoryPage } from "@/components/site/StoryPage";
import { GUIDE_PAGES, guideBySlug } from "@/content/guides";
import { SITE_URL } from "@/lib/site";

export function generateStaticParams() {
  return GUIDE_PAGES.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata(props: PageProps<"/guides/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const p = guideBySlug(slug);
  if (!p) return {};
  const url = `${SITE_URL}/guides/${p.slug}`;
  return {
    title: p.seo,
    description: p.meta,
    alternates: { canonical: url },
    openGraph: { type: "article", siteName: "Formkit", url, title: `${p.seo} | Formkit`, description: p.meta },
    twitter: { card: "summary_large_image", title: `${p.seo} | Formkit`, description: p.meta },
  };
}

export default async function GuidePage(props: PageProps<"/guides/[slug]">) {
  const { slug } = await props.params;
  const p = guideBySlug(slug);
  if (!p) notFound();
  return <StoryPage story={p} base="guides" crumb="Guides" />;
}
