import { LiveForm } from "@/components/live/LiveForm";
import { formMetadata, guardFormLink } from "@/components/live/deadLink";

export async function generateMetadata({ params }: PageProps<"/f/[slug]">) {
  const { slug } = await params;
  return formMetadata(slug);
}

/** A form published by an identity that has not claimed a link yet. */
export default async function UnclaimedFormPage({ params }: PageProps<"/f/[slug]">) {
  const { slug } = await params;
  await guardFormLink(slug);
  return <LiveForm slug={slug} />;
}
