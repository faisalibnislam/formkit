import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StoryPage } from "@/components/site/StoryPage";
import { USE_CASES, caseBySlug } from "@/content/features";
import { SITE_URL } from "@/lib/site";

export function generateStaticParams() {
  return USE_CASES.map((u) => ({ slug: u.slug }));
}

export async function generateMetadata(props: PageProps<"/use-cases/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const u = caseBySlug(slug);
  if (!u) return {};
  const url = `${SITE_URL}/use-cases/${u.slug}`;
  return {
    title: u.seo,
    description: u.meta,
    alternates: { canonical: url },
    openGraph: { type: "article", siteName: "Formkit", url, title: `${u.seo} | Formkit`, description: u.meta },
    twitter: { card: "summary_large_image", title: `${u.seo} | Formkit`, description: u.meta },
  };
}

export default async function UseCasePage(props: PageProps<"/use-cases/[slug]">) {
  const { slug } = await props.params;
  const u = caseBySlug(slug);
  if (!u) notFound();
  return <StoryPage story={u} base="use-cases" crumb="Use cases" />;
}
