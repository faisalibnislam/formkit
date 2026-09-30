import { OG_SIZE, OG_TYPE, ogImage } from "@/lib/og";

export const alt = "Formkit help centre";
export const size = OG_SIZE;
export const contentType = OG_TYPE;

export default function Image() {
  return ogImage({ kicker: "Help centre", title: "How to do anything in Formkit", sub: "Building, logic, AI, responses, companies and billing." });
}
