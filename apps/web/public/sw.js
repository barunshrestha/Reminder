/* eslint-disable no-restricted-globals */
const CACHE_NAME = "payment-reminder-shell-v1";
const SHELL = ["/", "/dashboard", "/offline"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") {
    return;
  }
  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/")) {
    return;
  }
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match("/offline").then((cached) => cached ?? caches.match("/")),
      ),
    );
    return;
  }
  event.respondWith(
    caches.match(request).then((cached) => cached ?? fetch(request)),
  );
});

self.addEventListener("push", (event) => {
  let payload = {
    title: "Payment Reminder",
    body: "You have a new alert",
    url: "/dashboard",
    tag: "alert",
  };
  try {
    payload = { ...payload, ...event.data?.json() };
  } catch {
    // ignore malformed payloads
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icons/icon.svg",
      badge: "/icons/icon.svg",
      tag: payload.tag,
      data: { url: payload.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url ?? "/dashboard";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(target);
      }
      return undefined;
    }),
  );
});
