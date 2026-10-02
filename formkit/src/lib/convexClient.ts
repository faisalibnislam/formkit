import { ConvexReactClient } from "convex/react";

/**
 * The one Convex client for the whole site. The app's pages authenticate it
 * through Convex Auth's Next.js provider (the server hands over the token);
 * the static marketing pages authenticate it from the browser (SiteSession).
 * Only one of the two is mounted at a time, so they never fight over it.
 */
const url = process.env.NEXT_PUBLIC_CONVEX_URL;

if (!url) {
  // Naming the fix rather than failing with "undefined is not a URL".
  throw new Error(
    "NEXT_PUBLIC_CONVEX_URL is not set. Copy .env.example to .env.local, or run `npx convex dev` to write it.",
  );
}

export const convex = new ConvexReactClient(url);
