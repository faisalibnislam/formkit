/*
 * Formkit's service worker, for push notifications only: no caching, no
 * offline pages. A push carries { title, body, href, tag } (convex/push.ts);
 * clicking it opens the link in a Formkit tab, reusing one if it is open.
 */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: event.data ? event.data.text() : "Formkit" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Formkit", {
      body: data.body || "",
      tag: data.tag || undefined,
      renotify: !!data.tag,
      icon: "/icon.png",
      badge: "/icon.png",
      data: { href: data.href || "/app" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const href = new URL((event.notification.data && event.notification.data.href) || "/app", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const tabs = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const same = tabs.find((c) => new URL(c.url).origin === self.location.origin);
      if (same) {
        await same.focus();
        if ("navigate" in same) return same.navigate(href);
        return undefined;
      }
      return self.clients.openWindow(href);
    })(),
  );
});
