import { OG_SIZE, OG_TYPE, ogImage } from "@/lib/og";

export const alt = "Formkit, the form builder";
export const size = OG_SIZE;
export const contentType = OG_TYPE;

export default function Image() {
  return ogImage({ kicker: "Form builder", title: "What will your next form do?", sub: "Build a form with AI, add logic that reads answers, take payments and reply to every response." });
}
