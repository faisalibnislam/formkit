import { OG_SIZE, OG_TYPE, ogImage } from "@/lib/og";

export const alt = "Formkit features";
export const size = OG_SIZE;
export const contentType = OG_TYPE;

export default function Image() {
  return ogImage({ kicker: "Features", title: "Everything a form can do here", sub: "AI building, logic, quizzes, AI replies, payments and integrations." });
}
