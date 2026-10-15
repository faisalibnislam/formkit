"use client";

/**
 * This browser's side of push notifications: the service worker in
 * public/push-sw.js and the subscription the server sends to (convex/push.ts).
 *
 * While push is on here, the in-app browser alerts leave system notifications
 * to the service worker, so nothing arrives twice (useInboxAlerts).
 */

const SW = "/push-sw.js";
const KEY = "fk.push";

export function pushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/** Whether this browser is signed up, as last seen here. */
export function pushOnHere() {
  try {
    return !!window.localStorage.getItem(KEY) && Notification.permission === "granted";
  } catch {
    return false;
  }
}

function remember(endpoint: string | null) {
  try {
    if (endpoint) window.localStorage.setItem(KEY, endpoint);
    else window.localStorage.removeItem(KEY);
  } catch {
    // Private windows can refuse storage; push still works.
  }
  window.dispatchEvent(new Event("fk:push"));
}

/** The subscription this browser holds, if any. */
export async function currentEndpoint(): Promise<string | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration(SW);
  const sub = await reg?.pushManager.getSubscription();
  return sub?.endpoint ?? null;
}

const toKey = (b64: string) => {
  const s = atob(b64.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b64.length + 3) % 4));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
};
const toB64 = (buf: ArrayBuffer | null) =>
  buf ? btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") : "";

export type Subscribed = { endpoint: string; p256dh: string; auth: string; userAgent: string };

/** Asks the browser, then signs this device up. */
export async function turnOnPush(publicKey: string): Promise<Subscribed | "denied" | "unsupported"> {
  if (!pushSupported()) return "unsupported";
  const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
  if (permission !== "granted") return "denied";
  const reg = await navigator.serviceWorker.register(SW, { scope: "/" });
  await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  const sub = existing ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(publicKey) }));
  remember(sub.endpoint);
  return { endpoint: sub.endpoint, p256dh: toB64(sub.getKey("p256dh")), auth: toB64(sub.getKey("auth")), userAgent: navigator.userAgent };
}

/** Stops push here. Returns the address to forget on the server. */
export async function turnOffPush(): Promise<string | null> {
  remember(null);
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration(SW);
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return null;
  await sub.unsubscribe();
  return sub.endpoint;
}
