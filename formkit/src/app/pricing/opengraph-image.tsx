import { OG_SIZE, OG_TYPE, ogImage } from "@/lib/og";

export const alt = "Formkit pricing";
export const size = OG_SIZE;
export const contentType = OG_TYPE;

export default function Image() {
  return ogImage({ kicker: "Pricing", title: "Free to start. Simple when you grow.", sub: "Unlimited forms and members on Free. Pro from $6 a seat, Business $19, company by company." });
}
