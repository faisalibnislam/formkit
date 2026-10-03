"use client";

import { useEffect } from "react";
import { api } from "@convex/_generated/api";
import { useSeededQuery } from "@/lib/seed";
import { useSiteSession } from "@/components/site/SiteSession";
import { clearViewerHint, initialsOf, useViewerHint, writeViewerHint } from "@/lib/viewerHint";

/** What the nav needs to draw someone. */
export type NavAccount = {
  name: string;
  email: string;
  initials: string;
  image: string | null;
  plan: string | null;
};

/**
 * Who to show in the nav: a person, nobody, or "unknown" while a static
 * marketing page is still finding out.
 *
 * Inside the app the server has already said (seeded), so it is never
 * unknown. On a marketing page, an empty answer means nothing until
 * SiteSession has asked the server; meanwhile the remembered viewer stands in,
 * and once the real one arrives it is written back for next time.
 */
export function useNavAccount(): NavAccount | null | "unknown" {
  const session = useSiteSession();
  // On a marketing page, only ask once the session check says someone is
  // signed in: an anonymous visitor then never opens a Convex connection.
  const live = useSeededQuery(api.users.viewer, session === null || session === "in" ? {} : "skip");
  const hint = useViewerHint();

  useEffect(() => {
    if (session !== null && live) writeViewerHint(live);
  }, [session, live]);

  if (live) {
    return {
      name: live.name,
      email: live.email,
      initials: initialsOf(live.name),
      image: live.image,
      plan: live.plan?.id ?? null,
    };
  }
  // In the app, or the check has come back empty: signed out.
  if (session === null || session === "out") return null;
  return hint ?? "unknown";
}

/**
 * Signs out through the same route the sign-in form uses (it clears the
 * session cookies), forgets the remembered viewer, and reloads onto the home
 * page so every open subscription starts again signed out. Works the same on
 * a static page and inside the app.
 */
export async function signOutEverywhere() {
  try {
    await fetch("/api/auth", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "auth:signOut", args: {} }),
    });
  } catch {
    /* the cookies may still be cleared; carry on either way */
  }
  clearViewerHint();
  // A full load on purpose: the Convex connection must start over signed out.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign("/");
}
