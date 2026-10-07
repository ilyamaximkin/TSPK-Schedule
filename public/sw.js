/*
 * TSPK schedule bot — service worker.
 *
 * The page shows schedule notifications itself (via
 * registration.showNotification), this worker only handles clicks so
 * tapping a notification focuses the existing tab (or opens a new one).
 * There is deliberately no fetch handler — no offline caching.
 */
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of clientList) {
        if ("focus" in client) return client.focus();
      }
      return self.clients.openWindow("/");
    })(),
  );
});
