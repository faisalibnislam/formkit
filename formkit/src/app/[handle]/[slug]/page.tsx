import { LiveForm } from "@/components/live/LiveForm";

/**
 * A form at a claimed link - formkit.app/<handle>/<slug>.
 *
 * The handle is verified against the form's identity on the server, so one
 * person's link cannot be used to read another's form.
 */
export default async function ClaimedFormPage({ params }: PageProps<"/[handle]/[slug]">) {
  const { handle, slug } = await params;
  return <LiveForm slug={slug} handle={handle} />;
}
