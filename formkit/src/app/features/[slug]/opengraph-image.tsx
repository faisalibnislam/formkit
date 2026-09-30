import { OG_SIZE, OG_TYPE, ogImage } from "@/lib/og";
import { featureBySlug } from "@/content/features";

export const alt = "A Formkit feature";
export const size = OG_SIZE;
export const contentType = OG_TYPE;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const f = featureBySlug(slug);
  return ogImage(f ? { kicker: f.kicker, title: f.title, sub: f.plan } : { kicker: "Features", title: "Formkit features" });
}
