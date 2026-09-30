import { OG_SIZE, OG_TYPE, ogImage } from "@/lib/og";
import { templateBySlug } from "@/content/templates";

export const alt = "A Formkit form template";
export const size = OG_SIZE;
export const contentType = OG_TYPE;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const t = templateBySlug(slug);
  return ogImage(t ? { kicker: "Template", title: t.name, sub: t.blurb } : { kicker: "Templates", title: "Form templates" });
}
