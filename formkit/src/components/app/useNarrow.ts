"use client";

import { useSyncExternalStore } from "react";

/**
 * Whether the viewport is phone-width, for the few screens that swap a table
 * for cards rather than merely reflowing.
 */
export function useNarrow(max = 640) {
  const query = `(max-width: ${max}px)`;
  return useSyncExternalStore(
    (on) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", on);
      return () => mq.removeEventListener("change", on);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
