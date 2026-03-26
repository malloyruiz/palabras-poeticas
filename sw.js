const CACHE_NAME = 'lumina-v4'; // Incrementado para forzar la actualización en los navegadores
const ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/icon-192.png',
    '/icon-512.png',
    '/icon-1024.png',
    '/screenshot1.png'
];

// INSTALACIÓN: Pre-cachear solo activos críticos locales
self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('SW: Pre-cacheando activos locales...');
            return cache.addAll(ASSETS);
        })
    );
});

// ACTIVACIÓN: Limpiar cachés antiguos
self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keyList => {
            return Promise.all(
                keyList.map(key => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// ESTRATEGIA: Stale-While-Revalidate (SWR)
// Carga instantánea desde caché mientras se verifica actualización en segundo plano
self.addEventListener('fetch', e => {
    if (e.request.method !== 'GET') return;
    
    e.respondWith(
        caches.open(CACHE_NAME).then(cache => {
            return cache.match(e.request).then(response => {
                const fetchPromise = fetch(e.request).then(networkResponse => {
                    // Actualizar el caché en segundo plano. Esto cacheará Google Fonts y FontAwesome automáticamente.
                    // Aceptamos status 0 para respuestas opacas (CORS) de recursos externos.
                    if (networkResponse && (networkResponse.status === 200 || networkResponse.status === 0)) {
                        cache.put(e.request, networkResponse.clone());
                    }
                    return networkResponse;
                }).catch(() => {
                    // Manejo de error silencioso
                });
                
                // Retornar caché inmediatamente (si existe) o esperar al fetch
                return response || fetchPromise;
            });
        })
    );
});

// Listener para actualizaciones (PWABuilder pwa-update)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// EVENTOS DE NOTIFICACIÓN
self.addEventListener('notificationclick', e => {
    e.notification.close();
    e.waitUntil(
        clients.matchAll({ type: 'window' }).then(clientList => {
            if (clientList.length > 0) return clientList[0].focus();
            return clients.openWindow('/'); // Corregido de './' a '/'
        })
    );
});
