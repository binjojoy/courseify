const CACHE_NAME = 'courseify-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Pass YouTube and external API calls through directly
  if (event.request.url.includes('youtube.com') || 
      event.request.url.includes('googlevideo.com') || 
      event.request.url.includes('ytimg.com') ||
      event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request).catch(() => {
        if (event.request.destination === 'document') {
          return caches.match('/index.html');
        }
      });
    })
  );
});
