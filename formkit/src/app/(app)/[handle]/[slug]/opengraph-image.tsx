import { OG_SIZE, OG_TYPE, formCard } from "@/lib/og";
import { linkState } from "@/components/live/deadLink";

export const alt = "The form";
export const size = OG_SIZE;
export const contentType = OG_TYPE;

/** The card a shared link to this form shows: its title, on its owner's colour. */
export default async function Image({ params }: { params: Promise<Record<string, string>> }) {
  const { slug, handle } = await params;
  const state = await linkState(slug!, handle);
  return formCard({
    title: state?.live && state.title ? state.title : "This form",
    owner: state?.name ?? null,
    about: state?.about ?? null,
    color: state?.color ?? null,
  });
}
