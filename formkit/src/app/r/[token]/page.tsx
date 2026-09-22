import { ResumeForm } from "@/components/live/ResumeForm";

/** The link an owner sends somebody who left a form half-answered. */
export default async function ResumePage({ params }: PageProps<"/r/[token]">) {
  const { token } = await params;
  return <ResumeForm token={token} />;
}
