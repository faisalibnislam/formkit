import { fetchQuery } from "convex/nextjs";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { api } from "../../../convex/_generated/api";
import { isOwnHost } from "@/lib/site";

/**
 * A link to a form that has been unpublished, archived or deleted is dead.
 * On a customer's own domain it goes to that domain's home, which lists what
 * is open there; on formkit.app it goes to the owner's domain when they have
 * one, and is a 404 otherwise. Runs on the server, before the form renders.
 */
export async function guardFormLink(slug: string, handle?: string) {
  let state: { live: boolean; home: string | null } | null = null;
  try {
    state = await fetchQuery(api.publicForm.linkState, { slug, handle });
  } catch {
    // Convex unreachable: let the page load and say what it can.
    return;
  }
  if (!state || state.live) return;
  const host = ((await headers()).get("host") ?? "").split(":")[0]!.toLowerCase();
  if (host && !isOwnHost(host)) redirect("/");
  if (state.home) redirect(`https://${state.home}/`);
  notFound();
}
