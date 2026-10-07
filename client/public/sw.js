// Service Worker: einfaches App-Shell-Caching fuer Offline-/Low-Bandwidth-Nutzung
// (Kann-Ziel). Statische Assets werden "cache-first" bedient, API-Anfragen
// "network-first" mit Fallback auf den Cache, damit zuletzt geladene Daten auch
// ohne Verbindung sichtbar bleiben.
// Version erhoehen, wenn sich die App-Shell aendert (alte Caches werden geloescht).
const CACHE = 'stars-shell-v2';
const SHELL = ['/', '/index.html', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Seitenaufrufe (index.html) network-first: sonst bliebe nach einem Update
  // dauerhaft die alte App-Shell mit veralteten Bundle-Verweisen aktiv.
  if (url.pathname.startsWith('/api/') || request.mode === 'navigate') {
    // Network-first fuer Daten und HTML.
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request).then((r) => r || caches.match('/index.html')))
    );
    return;
  }

  // Cache-first fuer statische Ressourcen (App-Shell, JS, CSS).
  event.respondWith(
    caches.match(request).then((cached) =>
      cached ||
      fetch(request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(request, copy));
        return res;
      })
    )
  );
});
