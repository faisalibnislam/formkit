"use client";

import { ConvexAuthNextjsProvider } from "@convex-dev/auth/nextjs";
import { ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";

const url = process.env.NEXT_PUBLIC_CONVEX_URL;

if (!url) {
  // Naming the fix rather than failing with "undefined is not a URL".
  throw new Error(
    "NEXT_PUBLIC_CONVEX_URL is not set. Copy .env.example to .env.local, or run `npx convex dev` to write it.",
  );
}

const convex = new ConvexReactClient(url);

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return <ConvexAuthNextjsProvider client={convex}>{children}</ConvexAuthNextjsProvider>;
}
