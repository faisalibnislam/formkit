"use client";

import { useState } from "react";

/**
 * Whether a query has ever answered. A page shows its skeleton only until the
 * first answer — after that, changing a filter keeps the old results on
 * screen rather than flashing placeholders on every keystroke.
 */
export function useFirstLoad(value: unknown) {
  const [loaded, setLoaded] = useState(value !== undefined);
  if (!loaded && value !== undefined) setLoaded(true);
  return loaded || value !== undefined;
}

/**
 * The latest answer a query has given. When its arguments change — a new date
 * range, say — the previous answer stays on screen until the new one arrives,
 * instead of the page emptying and refilling.
 */
export function useLastDefined<T>(value: T | undefined): T | undefined {
  const [last, setLast] = useState<T | undefined>(value);
  if (value !== undefined && value !== last) setLast(value);
  return value ?? last;
}
