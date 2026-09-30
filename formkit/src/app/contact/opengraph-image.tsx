import { OG_SIZE, OG_TYPE, ogImage } from "@/lib/og";

export const alt = "Contact Formkit";
export const size = OG_SIZE;
export const contentType = OG_TYPE;

export default function Image() {
  return ogImage({ kicker: "Contact", title: "Talk to a person at Formkit", sub: "Questions, billing, bugs or ideas. We answer every message." });
}
