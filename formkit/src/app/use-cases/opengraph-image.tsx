import { OG_SIZE, OG_TYPE, ogImage } from "@/lib/og";

export const alt = "Formkit use cases";
export const size = OG_SIZE;
export const contentType = OG_TYPE;

export default function Image() {
  return ogImage({ kicker: "Use cases", title: "Forms for the way your team works", sub: "Agencies, schools, sales, events and HR." });
}
