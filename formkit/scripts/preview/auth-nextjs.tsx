"use client";

import type { ReactNode } from "react";

/** Stands in for `@convex-dev/auth/nextjs` while `FK_PREVIEW=1`. */
export function ConvexAuthNextjsProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
