import type { Metadata } from "next";
import { ResumeForm } from "@/components/live/ResumeForm";

export const metadata: Metadata = { title: "Pick up where you left off", robots: { index: false, follow: false } };

/** The link an owner sends somebody who left a form half-answered. */
export default async function ResumePage({ params }: PageProps<"/r/[token]">) {
  const { token } = await params;
  return <ResumeForm token={token} />;
}
