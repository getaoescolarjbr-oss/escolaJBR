// Service Worker - Portal Professor JBR
// Handles Web Push Notifications

const CACHE_NAME = 'portal-jbr-v1';

// ─── Push Event ───────────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'Portal JBR', body: event.data ? event.data.text() : 'Nova notificação' };
  }

  const title = data.title || 'Portal Professor JBR';
  const options = {
    body: data.body || 'Você tem uma nova notificação.',
    icon: data.icon || '/icon-192.png',
    badge: data.badge || '/icon-192.png',
    tag: data.tag || 'portal-jbr',
    data: {
      url: data.url || '/',
      ...data.data,
    },
    requireInteraction: data.requireInteraction || false,
    silent: false,
    vibrate: [200, 100, 200],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ─── Notification Click ───────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it and navigate
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.postMessage({ type: 'NOTIFICATION_CLICK', url });
          return;
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// ─── Push Subscription Change ─────────────────────────────────────────────────
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.registration.pushManager
      .subscribe({
        userVisibleOnly: true,
        applicationServerKey: event.oldSubscription
          ? event.oldSubscription.options.applicationServerKey
          : null,
      })
      .then((subscription) => {
        // Notify clients about subscription change
        return clients.matchAll({ type: 'window' }).then((clientList) => {
          clientList.forEach((client) => {
            client.postMessage({ type: 'PUSH_SUBSCRIPTION_CHANGED', subscription });
          });
        });
      })
  );
});

// ─── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('install', (event) => {
  self.skipWaiting();
});
