import { OG_SIZE, OG_TYPE, ogImage } from "@/lib/og";
import { helpArticle } from "@/content/help";

export const alt = "A Formkit help article";
export const size = OG_SIZE;
export const contentType = OG_TYPE;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = helpArticle(slug);
  return ogImage(a ? { kicker: `Help · ${a.category.name}`, title: a.title, sub: a.summary } : { kicker: "Help centre", title: "Formkit help" });
}
