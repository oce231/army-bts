/* ══════════════════════════════════════════════
   SERVICE WORKER — Notifications Push
   Bangtan Atlas
══════════════════════════════════════════════ */

const CACHE = 'atlas-v1';
const IMG_CACHE = 'atlas-img-v1';
const IMG_MAX = 250; // limite d'images gardées en cache
const SHELL = ['hub.html','games.html','dance.html','study.html','community.html','style.css','games.css','hub.css','Photo/icon-192.png'];

self.addEventListener('install', function(event) {
  self.skipWaiting();
  // Pré-cache léger (sans index.html, trop lourd) ; un échec ne bloque pas l'installation
  event.waitUntil(caches.open(CACHE).then(function(c) {
    return Promise.all(SHELL.map(function(u) { return c.add(u).catch(function() {}); }));
  }));
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(k) { return k !== CACHE && k !== IMG_CACHE; }).map(function(k) { return caches.delete(k); }));
    }).then(function() { return self.clients.claim(); })
  );
});

function trim(cache) {
  return cache.keys().then(function(keys) {
    if (keys.length <= IMG_MAX) return;
    return Promise.all(keys.slice(0, keys.length - IMG_MAX).map(function(k) { return cache.delete(k); }));
  });
}

// Pages, CSS, JS : réseau d'abord (toujours la dernière version), cache en secours hors ligne.
// Images du site : cache d'abord, mises à jour en arrière-plan.
// Tout le reste (Supabase, YouTube, Spotify…) : on ne touche à rien.
self.addEventListener('fetch', function(event) {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.destination === 'image') {
    event.respondWith(caches.open(IMG_CACHE).then(function(cache) {
      return cache.match(req).then(function(hit) {
        const net = fetch(req).then(function(res) {
          if (res && res.ok) { cache.put(req, res.clone()).then(function() { trim(cache); }); }
          return res;
        }).catch(function() { return hit; });
        return hit || net;
      });
    }));
    return;
  }

  if (req.mode === 'navigate' || /\.(css|js|json|html)$/.test(url.pathname)) {
    event.respondWith(fetch(req).then(function(res) {
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(function(c) { c.put(req, copy); }); }
      return res;
    }).catch(function() {
      return caches.match(req, { ignoreSearch: true }).then(function(hit) {
        return hit || new Response('<meta charset="utf-8"><meta name="viewport" content="width=device-width"><body style="font-family:sans-serif;background:#0a0a12;color:#fff;text-align:center;padding:3rem 1rem"><h2>Hors ligne 💜</h2><p>Cette page n\u2019a pas encore été chargée. Reconnecte-toi et réessaie.</p></body>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      });
    }));
  }
});

// Réception d'une notification push envoyée par le serveur
self.addEventListener('push', function(event) {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) {}

  const title = data.title || 'Bangtan Atlas';
  const options = {
    body: data.body || '',
    icon: 'Photo/Preview.jpg',
    badge: 'Photo/Preview.jpg',
    data: { url: data.url || 'community.html' },
    vibrate: [80, 40, 80]
  };

  if (data.tag) { options.tag = data.tag; options.renotify = true; }

  // Si le site est déjà ouvert et au premier plan, la page gère elle-même l'alerte
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list) {
      const active = list.some(function(c) { return c.visibilityState === 'visible' && c.focused; });
      if (active) return;
      return self.registration.showNotification(title, options);
    })
  );
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
