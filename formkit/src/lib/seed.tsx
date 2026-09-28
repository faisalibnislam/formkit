"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useQuery } from "convex/react";
import type { FunctionReference } from "convex/server";
import { api } from "../../convex/_generated/api";
import { seedKey, type Clock, type Seeds } from "./seedKey";

/**
 * First-paint data.
 *
 * Convex queries only arrive once the browser has connected, so a page drawn
 * on the server used to show the signed-out nav, an evening sky and empty
 * cards, then swap in the real ones a moment later - the flicker. The server
 * now fetches the handful of queries a page opens with (see seedServer.ts)
 * and hands them down here; each seeded query shows that value until its live
 * subscription answers, which is the same data, so nothing moves.
 *
 * Seeds are only ever a stand-in for the first render. Anything that acts -
 * a mutation in an effect - waits for the live value.
 */

type Ctx = { seeds: Seeds; clock: Clock | null };
const SeedContext = createContext<Ctx>({ seeds: {}, clock: null });

type AnyQuery = FunctionReference<"query">;

/** Nested providers add to their parent's seeds; the nearest clock wins. */
export function SeedProvider({ seeds, clock, children }: { seeds: Seeds; clock?: Clock | null; children: ReactNode }) {
  const parent = useContext(SeedContext);
  const value = useMemo(
    () => ({ seeds: { ...parent.seeds, ...seeds }, clock: clock ?? parent.clock }),
    [parent, seeds, clock],
  );
  return <SeedContext.Provider value={value}>{children}</SeedContext.Provider>;
}

/** The live value when there is one, otherwise the server's first-paint copy. */
export function useSeeded<T>(ref: AnyQuery, args: Record<string, unknown> | "skip", live: T | undefined): T | undefined {
  const { seeds } = useContext(SeedContext);
  if (live !== undefined || args === "skip") return live;
  const key = seedKey(ref, args);
  // A null seed is "signed out on the server"; the live answer decides.
  return (seeds[key] ?? undefined) as T | undefined;
}

/** useQuery, drawn from the server's copy until the live answer arrives. */
export function useSeededQuery<Q extends AnyQuery>(ref: Q, args: Q["_args"] | "skip" = {} as Q["_args"]) {
  const live = useQuery(ref, args as never) as Q["_returnType"] | undefined;
  return useSeeded(ref, args as Record<string, unknown> | "skip", live);
}

/** The signed-in person, seeded. */
export function useViewer() {
  return useSeededQuery(api.users.viewer, {});
}

/** The reader's hour and date as the server worked them out, in their timezone. */
export function useSeedClock() {
  return useContext(SeedContext).clock;
}
