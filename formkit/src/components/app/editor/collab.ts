"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

/**
 * Working on a form with other people: which question this person is on, who
 * else is here, and the request to open the comments panel.
 *
 * The builder knows the selected question; the header is what beats and what
 * mounts the comments drawer. Neither is a parent of the other, so the two
 * meet here.
 */

let current: string | null = null;
const currentListeners = new Set<() => void>();

export function setCurrentBlock(id: string | null) {
  if (current === id) return;
  current = id;
  for (const l of currentListeners) l();
}

function useCurrentBlock() {
  return useSyncExternalStore(
    (l) => {
      currentListeners.add(l);
      return () => currentListeners.delete(l);
    },
    () => current,
    () => null,
  );
}

/** A clock that moves in whole steps, so a query keyed on it is not re-run every render. */
function useStepClock(stepMs: number) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const tick = () => setNow(Math.floor(Date.now() / stepMs) * stepMs);
    const first = window.setTimeout(tick, 0);
    const t = window.setInterval(tick, stepMs);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(t);
    };
  }, [stepMs]);
  return now;
}

/** Say that this person has the form open, and where. Mount once per editor. */
export function usePresenceBeat(formId: Id<"forms">) {
  const beat = useMutation(api.presence.beat);
  const block = useCurrentBlock();
  useEffect(() => {
    const send = () => void beat({ formId, blockId: block ?? undefined }).catch(() => {});
    send();
    const t = window.setInterval(send, 20_000);
    return () => window.clearInterval(t);
  }, [beat, formId, block]);
}

export type Present = { userId: string; name: string; image: string | null; color: string; blockId: string | null };

/** Everyone else with the form open. */
export function usePresence(formId: Id<"forms">): Present[] {
  const now = useStepClock(15_000);
  const rows = useQuery(api.presence.here, now ? { formId, now } : "skip");
  return (rows ?? []) as Present[];
}

/* ---------- the comments panel ---------- */

type CommentsRequest = { blockId: string | null };
const commentListeners = new Set<(r: CommentsRequest) => void>();

export function openComments(blockId: string | null = null) {
  for (const l of commentListeners) l({ blockId });
}

export function useCommentRequests(onRequest: (r: CommentsRequest) => void) {
  useEffect(() => {
    commentListeners.add(onRequest);
    return () => {
      commentListeners.delete(onRequest);
    };
  }, [onRequest]);
}
