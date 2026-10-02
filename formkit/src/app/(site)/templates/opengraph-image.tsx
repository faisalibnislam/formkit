import { OG_SIZE, OG_TYPE, ogImage } from "@/lib/og";

export const alt = "Formkit form templates";
export const size = OG_SIZE;
export const contentType = OG_TYPE;

export default function Image() {
  return ogImage({ kicker: "Templates", title: "Form templates, ready to publish", sub: "Start from a proven form and make it yours in minutes." });
}
