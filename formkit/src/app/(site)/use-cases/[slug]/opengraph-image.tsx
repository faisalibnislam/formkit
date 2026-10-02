import { OG_SIZE, OG_TYPE, ogImage } from "@/lib/og";
import { caseBySlug } from "@/content/features";

export const alt = "A Formkit use case";
export const size = OG_SIZE;
export const contentType = OG_TYPE;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const u = caseBySlug(slug);
  return ogImage(u ? { kicker: u.kicker, title: u.title, sub: u.meta } : { kicker: "Use cases", title: "Formkit use cases" });
}
