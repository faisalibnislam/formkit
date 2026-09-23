"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

/**
 * What the editor header says about saving: "Saving…", "Saved just now",
 * "Saved 4 min ago", or that the last write failed.
 *
 * One module-level store, because a write can start anywhere in the editor —
 * a question card, the inspector, the design panel — and the header is not a
 * parent of any of them. `tracked()` wraps a mutation call so that nothing has
 * to remember to report on itself.
 */
type Status = { pending: number; savedAt: number | null; failed: boolean };

let status: Status = { pending: 0, savedAt: null, failed: false };
const listeners = new Set<() => void>();

function set(next: Status) {
  status = next;
  for (const l of listeners) l();
}

export async function tracked<T>(work: Promise<T>): Promise<T> {
  set({ ...status, pending: status.pending + 1 });
  try {
    const out = await work;
    set({ pending: Math.max(0, status.pending - 1), savedAt: Date.now(), failed: false });
    return out;
  } catch (e) {
    set({ ...status, pending: Math.max(0, status.pending - 1), failed: true });
    throw e;
  }
}

/** Opening another form starts the clock again. */
export function resetSaveStatus() {
  set({ pending: 0, savedAt: null, failed: false });
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

const serverSnapshot: Status = { pending: 0, savedAt: null, failed: false };

export function useSaveStatus(fallbackAt?: number) {
  const s = useSyncExternalStore(
    subscribe,
    () => status,
    () => serverSnapshot,
  );
  // Re-read the relative time every half minute.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = window.setTimeout(tick, 0);
    const t = window.setInterval(tick, 30_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(t);
    };
  }, [s.savedAt]);

  if (s.pending > 0) return { tone: "busy" as const, label: "Saving…" };
  if (s.failed) return { tone: "error" as const, label: "Not saved — check your connection" };
  const at = s.savedAt ?? fallbackAt ?? null;
  if (at === null || now === null) return { tone: "idle" as const, label: "" };
  return { tone: "idle" as const, label: `Saved ${ago(now - at)}` };
}

function ago(ms: number) {
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
}
