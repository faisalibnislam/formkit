import { OG_SIZE, OG_TYPE, ogImage } from "@/lib/og";
import { rivalBySlug } from "@/content/compare";

export const alt = "Formkit compared";
export const size = OG_SIZE;
export const contentType = OG_TYPE;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const r = rivalBySlug(slug);
  return ogImage(r ? { kicker: "Compare", title: `Formkit vs ${r.name}`, sub: r.line } : { kicker: "Compare", title: "Compare Formkit" });
}
