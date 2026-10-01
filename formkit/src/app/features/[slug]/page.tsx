import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StoryPage } from "@/components/site/StoryPage";
import { FEATURE_PAGES, featureBySlug } from "@/content/features";
import { SITE_URL } from "@/lib/site";

export function generateStaticParams() {
  return FEATURE_PAGES.map((f) => ({ slug: f.slug }));
}

export async function generateMetadata(props: PageProps<"/features/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const f = featureBySlug(slug);
  if (!f) return {};
  const url = `${SITE_URL}/features/${f.slug}`;
  return {
    title: f.seo,
    description: f.meta,
    alternates: { canonical: url },
    openGraph: { type: "article", siteName: "Formkit", url, title: `${f.seo} | Formkit`, description: f.meta },
    twitter: { card: "summary_large_image", title: `${f.seo} | Formkit`, description: f.meta },
  };
}

export default async function FeaturePage(props: PageProps<"/features/[slug]">) {
  const { slug } = await props.params;
  const f = featureBySlug(slug);
  if (!f) notFound();
  return <StoryPage story={f} base="features" crumb="Features" />;
}
