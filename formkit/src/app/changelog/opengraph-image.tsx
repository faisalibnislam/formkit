import { OG_SIZE, OG_TYPE, ogImage } from "@/lib/og";

export const alt = "Formkit changelog";
export const size = OG_SIZE;
export const contentType = OG_TYPE;

export default function Image() {
  return ogImage({ kicker: "Changelog", title: "What is new in Formkit", sub: "Everything that changed, newest first." });
}
