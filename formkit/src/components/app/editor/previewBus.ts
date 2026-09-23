"use client";

import { useEffect } from "react";

/**
 * "Preview" can be asked for from anywhere in the editor — the header menu,
 * the Design tab's Full screen button, the closing settings — and the overlay
 * lives in one place. This carries the request across.
 */
export type PreviewRequest = {
  device?: "desktop" | "tablet" | "mobile";
  /** Show the closed screen instead of the questions. */
  closed?: boolean;
};

const listeners = new Set<(r: PreviewRequest) => void>();

export function openPreview(request: PreviewRequest = {}) {
  for (const l of listeners) l(request);
}

export function usePreviewRequests(onRequest: (r: PreviewRequest) => void) {
  useEffect(() => {
    listeners.add(onRequest);
    return () => {
      listeners.delete(onRequest);
    };
  }, [onRequest]);
}
