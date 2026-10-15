import type { Metadata } from "next";
import { ReceiptPage } from "@/components/live/ReceiptPage";

export const metadata: Metadata = { title: "Your receipt", robots: { index: false } };

/** A respondent's own copy of what they sent, from the link in their confirmation. */
export default async function Receipt({ params }: PageProps<"/receipt/[token]">) {
  const { token } = await params;
  return <ReceiptPage token={token} />;
}
