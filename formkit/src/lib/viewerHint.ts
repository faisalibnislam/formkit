"use client";

import { useSyncExternalStore } from "react";
import { HINT_KEY as KEY } from "./viewerHintScript";

/**
 * "Signed in as…", remembered in this browser.
 *
 * The marketing pages are static: the same HTML for everyone, straight from
 * the CDN, so the server cannot draw your avatar in the nav. This note is how
 * the page knows before anything has loaded. The app writes it whenever it
 * knows who you are and clears it when you sign out; a tiny script in the
 * page's <head> (HINT_SCRIPT) reads it before the first paint, so the nav
 * shows your avatar from the start rather than flashing "Sign in". The real
 * session check then confirms it, or clears it.
 *
 * It holds only what the nav shows. It is not a credential: nothing is
 * allowed or refused because of it.
 */

export type ViewerHint = {
  name: string;
  email: string;
  initials: string;
  image: string | null;
  plan: string | null;
};

const EVENT = "fk-viewer-hint";

export function initialsOf(name: string | null | undefined) {
  return (
    (name ?? "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join("") || "FK"
  );
}

/** Same object until the stored note changes, as useSyncExternalStore needs. */
let lastRaw: string | null = null;
let lastHint: ViewerHint | null = null;
function read(): ViewerHint | null {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
  if (raw === lastRaw) return lastHint;
  lastRaw = raw;
  try {
    lastHint = raw ? (JSON.parse(raw) as ViewerHint) : null;
  } catch {
    lastHint = null;
  }
  return lastHint;
}

function apply(hint: ViewerHint | null) {
  const root = document.documentElement;
  if (!hint) {
    root.removeAttribute("data-fk-viewer");
    root.removeAttribute("data-fk-plan");
    return;
  }
  root.setAttribute("data-fk-viewer", hint.image ? "photo" : "");
  if (hint.plan) root.setAttribute("data-fk-plan", hint.plan);
  else root.removeAttribute("data-fk-plan");
}

export function writeViewerHint(v: { name?: string | null; email?: string | null; image?: string | null; plan?: { id?: string | null } | null }) {
  const hint: ViewerHint = {
    name: v.name ?? "",
    email: v.email ?? "",
    initials: initialsOf(v.name),
    image: v.image ?? null,
    plan: v.plan?.id ?? null,
  };
  const raw = JSON.stringify(hint);
  try {
    if (window.localStorage.getItem(KEY) === raw) return;
    window.localStorage.setItem(KEY, raw);
  } catch {
    return;
  }
  apply(hint);
  window.dispatchEvent(new Event(EVENT));
}

export function clearViewerHint() {
  try {
    if (window.localStorage.getItem(KEY) === null) return;
    window.localStorage.removeItem(KEY);
  } catch {
    return;
  }
  apply(null);
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  // Another tab signing in or out.
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** The remembered viewer; null on the server and during hydration, to match the static HTML. */
export function useViewerHint() {
  return useSyncExternalStore(subscribe, read, () => null);
}
