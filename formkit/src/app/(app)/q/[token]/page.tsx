import type { Metadata } from "next";
import { QuizResultsPage } from "@/components/live/QuizResultsPage";

export const metadata: Metadata = { title: "Your results", robots: { index: false } };

/** A quiz taker's own results, from the link on the thank-you screen or in their email. */
export default async function QuizResults({ params }: PageProps<"/q/[token]">) {
  const { token } = await params;
  return <QuizResultsPage token={token} />;
}
