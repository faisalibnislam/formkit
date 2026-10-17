import { OG_SIZE, OG_TYPE, ogImage } from "@/lib/og";
import { guideBySlug } from "@/content/guides";

export const alt = "A Formkit guide";
export const size = OG_SIZE;
export const contentType = OG_TYPE;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = guideBySlug(slug);
  return ogImage(p ? { kicker: p.kicker, title: p.title, sub: p.plan } : { kicker: "Guides", title: "Formkit guides" });
}
