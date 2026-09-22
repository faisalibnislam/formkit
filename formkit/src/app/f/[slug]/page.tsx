import { LiveForm } from "@/components/live/LiveForm";

/** A form published by an identity that has not claimed a link yet. */
export default async function UnclaimedFormPage({ params }: PageProps<"/f/[slug]">) {
  const { slug } = await params;
  return <LiveForm slug={slug} />;
}
