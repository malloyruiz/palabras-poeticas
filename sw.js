const CACHE_NAME = 'lumina-v3'; // Incrementado por actualización de estrategia
const ASSETS = [
    "index.html",
    "manifest.json",
    "icon-192.png",
    "icon-512.png",
    "icon-1024.png",
    "logo-footer.png",
    "screenshot1.png",
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
    'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400;1,700&family=Inter:wght@200;300;400;500;600&display=swap'
];

// INSTALACIÓN: Pre-cachear activos críticos
self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('SW: Pre-cacheando activos...');
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
                    // Actualizar el caché en segundo plano
                    if (networkResponse && networkResponse.status === 200) {
                        cache.put(e.request, networkResponse.clone());
                    }
                    return networkResponse;
                }).catch(() => {
                    // Si falla el fetch y no hay caché, podríamos devolver una página offline si existiera
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
            return clients.openWindow('./');
        })
    );
});
