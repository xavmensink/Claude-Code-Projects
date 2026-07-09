/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope;

// Injected by vite-plugin-pwa at build time
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Activate updated versions immediately instead of waiting for every open
// instance of the app to close — without this, deployed fixes never reach
// installed PWAs that are rarely fully closed.
self.skipWaiting();
self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

// ── Web Push ──────────────────────────────────────────────────────────────────
// Fired when a push arrives from the Cloudflare Worker (true background push).
self.addEventListener('push', (event: PushEvent) => {
  event.waitUntil(
    self.registration.showNotification('Rest Over! 💪', {
      body: 'Time to hit your next set!',
      icon: '/Claude-Code-Projects/icon-192.png',
      badge: '/Claude-Code-Projects/icon-192.png',
      // vibrate is not in the TS NotificationOptions type but is valid in browsers
      ...({ vibrate: [200, 100, 200, 100, 400] } as object),
      tag: 'rest-timer',
      renotify: true,
    } as NotificationOptions)
  );
});

// ── Message-based scheduling ──────────────────────────────────────────────────
// Backup path: when the page posts SCHEDULE_NOTIFICATION, we fire a notification
// via setTimeout. This works while the SW is alive (app briefly backgrounded).
// For a closed app, Web Push from the server is needed instead.
let scheduleTimeout: ReturnType<typeof setTimeout> | null = null;

self.addEventListener('message', (event: ExtendableMessageEvent) => {
  const { type, delay } = event.data ?? {};

  if (type === 'SCHEDULE_NOTIFICATION') {
    if (scheduleTimeout) clearTimeout(scheduleTimeout);
    event.waitUntil(
      new Promise<void>(resolve => {
        scheduleTimeout = setTimeout(async () => {
          await self.registration.showNotification('Rest Over! 💪', {
            body: 'Time to hit your next set!',
            icon: '/Claude-Code-Projects/icon-192.png',
            ...({ vibrate: [200, 100, 200, 100, 400] } as object),
            tag: 'rest-timer',
            renotify: true,
          } as NotificationOptions);
          scheduleTimeout = null;
          resolve();
        }, delay ?? 0);
      })
    );
  }

  if (type === 'CANCEL_NOTIFICATION') {
    if (scheduleTimeout) { clearTimeout(scheduleTimeout); scheduleTimeout = null; }
    self.registration.getNotifications({ tag: 'rest-timer' }).then(ns => ns.forEach(n => n.close()));
  }
});

// ── Notification click ────────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      const scope = self.registration.scope;
      for (const client of clients) {
        if (client.url.startsWith(scope) && 'focus' in client) {
          return (client as WindowClient).focus();
        }
      }
      return self.clients.openWindow(scope);
    })
  );
});
