"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { FlagKey } from "../../../convex/model/flags";
import { FLAGS } from "../../../convex/model/flags";

/**
 * The feature flags as they apply to whoever is looking. Until the answer
 * arrives, each flag reads as its default - what the product did before
 * flags existed - so nothing flickers away on load for the usual case.
 */
export function useFlags(): Record<FlagKey, boolean> {
  const mine = useQuery(api.flags.mine, {});
  if (mine) return mine;
  return Object.fromEntries(FLAGS.map((f) => [f.key, f.defaultOn])) as Record<FlagKey, boolean>;
}

export function useFlag(key: FlagKey) {
  return useFlags()[key];
}
