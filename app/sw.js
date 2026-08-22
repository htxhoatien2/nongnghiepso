/**
 * AGRIGIS PROGRESSIVE WEB APP (PWA) SERVICE WORKER v2.8.0
 * Network-First Strategy: Luôn ưu tiên nạp mã nguồn mới nhất từ mạng,
 * tự động lưu đệm và chỉ kích hoạt chế độ Offline khi mất sóng 4G/Wifi.
 */

const CACHE_NAME = 'agrigis-pwa-v3.2.4';

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css?v=3.2.4',
  './data/data_embedded.js?v=3.2.4',
  './js/supabase_config.js?v=3.2.4',
  './js/data.js?v=3.2.4',
  './js/auth.js?v=3.2.4',
  './js/sync.js?v=3.2.4',
  './js/admin.js?v=3.2.4',
  './js/map.js?v=3.2.4',
  './js/records.js?v=3.2.4',
  './js/farmers.js?v=3.2.4',
  './js/analytics.js?v=3.2.4',
  './js/services.js?v=3.2.4',
  './js/purchasing.js?v=3.2.4',
  './js/app.js?v=3.2.4'
];

// 1. INSTALL EVENT: Force immediate activation
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Installing AgriGIS Service Worker v2.8.0...');
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch(err => console.warn('Pre-cache partial note:', err));
    })
  );
});

// 2. ACTIVATE EVENT: Purge all older caches immediately
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activating & Purging old caches...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('[ServiceWorker] Deleting stale cache:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// 3. FETCH EVENT: NETWORK-FIRST STRATEGY (Always fetch latest code first)
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // Skip chrome-extension, non-http, and live analytics
  if (!url.protocol.startsWith('http')) return;

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Fallback to offline cache if network fails (out in the field)
        return caches.match(event.request);
      })
  );
});

