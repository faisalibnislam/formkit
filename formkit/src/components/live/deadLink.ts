import { cache } from "react";
import type { Metadata } from "next";
import { fetchQuery } from "convex/nextjs";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { api } from "../../../convex/_generated/api";
import { isOwnHost } from "@/lib/site";

type LinkState = {
  live: boolean;
  home: string | null;
  title: string | null;
  name: string | null;
  icon: string | null;
};

/** One lookup per request, shared by the page and its metadata. */
const linkState = cache(async (slug: string, handle?: string): Promise<LinkState | null> => {
  try {
    return await fetchQuery(api.publicForm.linkState, { slug, handle });
  } catch {
    return null;
  }
});

/**
 * A link to a form that has been unpublished, archived or deleted is dead.
 * On a customer's own domain it goes to that domain's home, which lists what
 * is open there; on formkit.app it goes to the owner's domain when they have
 * one, and is a 404 otherwise. Runs on the server, before the form renders.
 */
export async function guardFormLink(slug: string, handle?: string) {
  const state = await linkState(slug, handle);
  // Convex unreachable: let the page load and say what it can.
  if (!state || state.live) return;
  const host = ((await headers()).get("host") ?? "").split(":")[0]!.toLowerCase();
  if (host && !isOwnHost(host)) redirect("/");
  if (state.home) redirect(`https://${state.home}/`);
  notFound();
}

/** The browser tab for a live form: its title and owner, and their square logo. */
export async function formMetadata(slug: string, handle?: string): Promise<Metadata> {
  const state = await linkState(slug, handle);
  // Customers' forms are theirs, not Formkit's content: kept out of search results.
  const robots = { index: false, follow: false };
  if (!state?.live || !state.title) return { robots };
  return {
    robots,
    // The owner's name, not Formkit's: the form is theirs.
    title: { absolute: state.name ? `${state.title} · ${state.name}` : state.title },
    ...(state.icon ? { icons: { icon: state.icon, apple: state.icon } } : {}),
  };
}
