"use client";

/**
 * Stands in for `convex/react` while `FK_PREVIEW=1`.
 *
 * Only the hooks the application actually calls are here — `useQuery`,
 * `useMutation`, `useAction` and `useConvex`. Queries read the fixtures;
 * mutations log and resolve, so a click does not throw.
 */

import { useEffect, useState, type ReactNode } from "react";
import { getFunctionName } from "convex/server";
import { aiReply, fixtureFor } from "./fixtures";

function nameOf(reference: unknown) {
  try {
    return getFunctionName(reference as never);
  } catch {
    return String(reference);
  }
}

/**
 * Undefined until after mount, exactly like the real thing.
 *
 * A Convex query resolves over a socket in the browser, so it has nothing to
 * give during SSR and nothing on the first client render either. Handing the
 * fixtures over any sooner would make the harness server-render data the
 * product never server-renders — which hides real hydration bugs and invents
 * fake ones.
 */
export function useQuery(reference: unknown, ..._args: unknown[]) {
  void _args;
  const [ready, setReady] = useState(false);
  useEffect(() => {
    // ?fk_slow=2000 holds every query back, to see the loading states.
    const slow = Number(new URLSearchParams(window.location.search).get("fk_slow") ?? 0);
    const t = window.setTimeout(() => setReady(true), slow);
    return () => window.clearTimeout(t);
  }, []);
  return (ready ? fixtureFor(nameOf(reference)) : undefined) as never;
}

export function useMutation(reference: unknown) {
  const name = nameOf(reference);
  return (async (args: unknown) => {
    // eslint-disable-next-line no-console
    console.info("[preview] mutation", name, args);
    // The upload flow posts to whatever this returns, so it has to be a URL.
    if (name === "users:generateUploadUrl") return "/__preview_upload";
    return null;
  }) as never;
}

export function useAction(reference: unknown) {
  const name = nameOf(reference);
  if (name === "ai:run") {
    // A stand-in reply after a short wait, so the working steps show.
    return (async (args: { text: string; formId?: string; draft?: unknown }) => {
      await new Promise((r) => setTimeout(r, 1800));
      return aiReply(args);
    }) as never;
  }
  return useMutation(reference);
}

export function useConvex() {
  return {
    query: async (reference: unknown) => fixtureFor(nameOf(reference)),
    mutation: async () => null,
    action: async () => null,
  } as never;
}

export function usePaginatedQuery(reference: unknown) {
  const page = fixtureFor(nameOf(reference));
  return { results: Array.isArray(page) ? page : [], status: "Exhausted", loadMore: () => {}, isLoading: false } as never;
}

export function useConvexAuth() {
  return { isLoading: false, isAuthenticated: true };
}

export class ConvexReactClient {
  constructor(public url?: string) {}
  setAuth() {}
  clearAuth() {}
  close() {
    return Promise.resolve();
  }
}

export function ConvexProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function Authenticated({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function Unauthenticated() {
  return null;
}

export function AuthLoading() {
  return null;
}
