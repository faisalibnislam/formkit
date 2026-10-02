"use client";

import { useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { clearViewerHint, writeViewerHint } from "@/lib/viewerHint";

/**
 * Keeps the remembered viewer (viewerHint.ts) in step with who is really
 * signed in, from inside the app: written as soon as Convex knows them,
 * cleared once it knows nobody is. Renders nothing.
 */
export function ViewerHintSync() {
  const viewer = useQuery(api.users.viewer, {});
  useEffect(() => {
    if (viewer === undefined) return;
    if (viewer) writeViewerHint(viewer);
    else clearViewerHint();
  }, [viewer]);
  return null;
}
