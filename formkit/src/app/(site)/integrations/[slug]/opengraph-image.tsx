import { OG_SIZE, OG_TYPE, ogImage } from "@/lib/og";
import { integrationBySlug } from "@/content/integrations";

export const alt = "A Formkit integration";
export const size = OG_SIZE;
export const contentType = OG_TYPE;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = integrationBySlug(slug);
  return ogImage(p ? { kicker: p.kicker, title: p.title, sub: p.plan } : { kicker: "Integrations", title: "Formkit integrations" });
}
