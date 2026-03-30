importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');

const CACHE_NAME = 'lumina-v9'; // v9: Actualización de API URL y fixes de diseño
const ASSETS = [
    "index.html",
    "manifest.json",
    "icon-192.png",
    "icon-512.png",
    "icon-1024.png",
    "screenshot1.png",
    "screenshot2.png",
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
    'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400;1,700&family=Inter:wght@200;300;400;500;600&display=swap'
];

self.addEventListener('install', e => {
    self.skipWaiting(); // Tomar el control inmediatamente, sin "waiting"
    e.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
    );
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keyList => Promise.all(
            keyList.map(key => key !== CACHE_NAME ? caches.delete(key) : null)
        )).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', e => {
    if (e.request.method !== 'GET') return;
    e.respondWith(
        caches.open(CACHE_NAME).then(cache => {
            return cache.match(e.request).then(response => {
                const fetchPromise = fetch(e.request).then(networkResponse => {
                    if (networkResponse && networkResponse.status === 200) {
                        cache.put(e.request, networkResponse.clone());
                    }
                    return networkResponse;
                }).catch(() => {});
                return response || fetchPromise;
            });
        })
    );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('notificationclick', e => {
    e.notification.close();
    e.waitUntil(
        clients.matchAll({ type: 'window' }).then(clientList => {
            if (clientList.length > 0) return clientList[0].focus();
            return clients.openWindow('./');
        })
    );
});

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'fetch-daily-wisdom') {
    event.waitUntil(fetchDailyWisdom());
  }
});

async function fetchDailyWisdom() {
  const cache = await caches.open(CACHE_NAME);
  const API = "https://script.google.com/macros/s/AKfycbxH7lP92TiRom-3bTiYnwfE6Z-sfDR5wcfaO4gTN0TD6EwuBYMtdCs4b06RFbqqnyw/exec";
  try {
     const response = await fetch(`${API}?action=notifs&userType=Free`); // Simplificado para fondo
     if (response.ok) {
        const data = await response.json();
        await cache.put('last-periodic-sync', new Response(JSON.stringify({date: new Date().toDateString(), data})));
     }
  } catch (e) { console.error("Periodic sync fetch failed", e); }
}
