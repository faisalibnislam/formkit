import { OG_SIZE, OG_TYPE, ogImage } from "@/lib/og";

export const alt = "Formkit guides";
export const size = OG_SIZE;
export const contentType = OG_TYPE;

export default function Image() {
  return ogImage({ kicker: "Guides", title: "Guides to building better forms", sub: "Payments, conditional logic and Google Sheets, step by step." });
}
