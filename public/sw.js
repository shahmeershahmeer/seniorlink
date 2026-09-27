// SeniorLink service worker: shows medicine reminders (required for notifications on Android)
// and makes the app installable. It deliberately does not cache pages, so data is always live.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// A fetch handler is part of what makes the app installable; network only.
self.addEventListener("fetch", () => {});

// Tapping a notification opens (or focuses) the app on the right screen.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("navigate" in client) return client.navigate(url).then((c) => c && c.focus());
      }
      return self.clients.openWindow(url);
    }),
  );
});
