/* ══════════════════════════════════════════════
   SERVICE WORKER — Notifications Push
   BTS Archive Universe
══════════════════════════════════════════════ */

self.addEventListener('install', function(event) {
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(self.clients.claim());
});

// Réception d'une notification push envoyée par le serveur
self.addEventListener('push', function(event) {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) {}

  const title = data.title || 'BTS Archive';
  const options = {
    body: data.body || '',
    icon: 'Photo/Preview.jpg',
    badge: 'Photo/Preview.jpg',
    data: { url: data.url || 'community.html' },
    vibrate: [80, 40, 80]
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Clic sur la notification : ouvre ou remet au premier plan la page concernée
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const targetUrl = new URL(event.notification.data && event.notification.data.url || 'community.html', self.location).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (const client of clientList) {
        if (client.url === targetUrl && 'focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
