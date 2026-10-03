/**
 * The visitor's answer to the analytics question on the marketing pages.
 *
 * Kept in localStorage rather than a cookie, so asking does not itself set
 * one. Nothing is stored until the visitor chooses; until then (or when
 * storage is blocked) the answer is "unset" and Google Analytics stays off.
 */

export type Consent = "granted" | "denied" | "unset";

const KEY = "fk_analytics_consent";
/** Fired on window to bring the banner back (the footer's "Cookie settings"). */
export const CONSENT_OPEN_EVENT = "fk:consent-open";
/** Fired on window whenever the stored answer changes in this tab. */
export const CONSENT_CHANGE_EVENT = "fk:consent-change";

/** The GA4 measurement ID; analytics, and the banner, exist only when it is set. */
export const GA_ID = process.env.NEXT_PUBLIC_GA_ID ?? "";

export function readConsent(): Consent {
  try {
    const v = window.localStorage.getItem(KEY);
    return v === "granted" || v === "denied" ? v : "unset";
  } catch {
    return "unset";
  }
}

export function writeConsent(value: Exclude<Consent, "unset">) {
  try {
    window.localStorage.setItem(KEY, value);
  } catch {
    /* storage blocked: the banner asks again next visit */
  }
  window.dispatchEvent(new Event(CONSENT_CHANGE_EVENT));
}

/** For useSyncExternalStore: this tab's changes, and other tabs' via `storage`. */
export function subscribeConsent(onChange: () => void) {
  window.addEventListener(CONSENT_CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CONSENT_CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Removes the cookies Google Analytics set, on this host and the parent domain. */
export function clearAnalyticsCookies() {
  const host = window.location.hostname;
  const domains = ["", host, `.${host.replace(/^www\./, "")}`];
  for (const raw of document.cookie.split(";")) {
    const name = raw.split("=")[0].trim();
    if (!/^_ga(_|$)|^_gid$|^_gat/.test(name)) continue;
    for (const d of domains) {
      document.cookie = `${name}=; Max-Age=0; path=/${d ? `; domain=${d}` : ""}`;
    }
  }
}

export function openConsentSettings() {
  window.dispatchEvent(new Event(CONSENT_OPEN_EVENT));
}
