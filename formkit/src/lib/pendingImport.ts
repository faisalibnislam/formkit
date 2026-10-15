"use client";

/**
 * A form link someone pasted on a compare page before they had an account.
 * Kept in this browser through sign-up, the emailed code and onboarding, and
 * imported the moment they reach the app (PendingImport). Gone after a day.
 */

const KEY = "fk.pendingImport";
const DAY = 24 * 3600_000;

export function keepImport(url: string) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ url, at: Date.now() }));
  } catch {
    // Private windows can refuse storage; the import box still says what to do.
  }
}

/** The link waiting, once: reading it clears it. */
export function takeImport(): string | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    window.localStorage.removeItem(KEY);
    const v = JSON.parse(raw) as { url?: string; at?: number };
    return v.url && v.at && Date.now() - v.at < DAY ? v.url : null;
  } catch {
    return null;
  }
}
