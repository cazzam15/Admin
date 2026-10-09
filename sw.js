// Service worker for the Higher Administration & IT revision app.
// Relative paths so it works at cazzam15.github.io/Admin/ (scope = the folder this file is in).
const CACHE_NAME = 'hadmin-v1';
const ASSETS = [
  './',
  './index.html',
  './assets/styles.css?v=1',
  './assets/data.js?v=1',
  './assets/app.js?v=1',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Install — cache the app (an asset that fails to download does not block install)
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return Promise.all(ASSETS.map(function(url) {
        return cache.add(url).catch(function() {});
      }));
    })
  );
  self.skipWaiting();
});

// Activate — clean up old caches belonging to this app only
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(key => key.startsWith('hadmin-') && key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch — network-first for the app shell (so updates reach users),
// cache-first for everything else
self.addEventListener('fetch', function(event) {
  if (event.request.method !== 'GET') return;
  const isAppShell = event.request.mode === 'navigate' ||
    event.request.url.endsWith('/index.html');
  if (isAppShell) {
    event.respondWith(
      fetch(event.request).then(function(response) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return response;
      }).catch(function() {
        return caches.match(event.request).then(c => c || caches.match('./index.html'));
      })
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      return cached || fetch(event.request).then(function(response) {
        if (response.status === 200 && new URL(event.request.url).origin === self.location.origin) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return response;
      });
    })
  );
});
