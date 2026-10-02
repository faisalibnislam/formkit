import { OG_SIZE, OG_TYPE, ogImage } from "@/lib/og";

export const alt = "Compare Formkit";
export const size = OG_SIZE;
export const contentType = OG_TYPE;

export default function Image() {
  return ogImage({ kicker: "Compare", title: "Formkit and the form builders you know", sub: "An honest, feature by feature look, and when to pick each." });
}
