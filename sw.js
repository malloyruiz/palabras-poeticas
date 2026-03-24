const CACHE_NAME = 'lumina-v2';
const ASSETS = [
    './',
    './index.html',
    './manifest.json',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

self.addEventListener('install', e => {
    self.skipWaiting(); // Fuerza a instalar e interrumpir la vieja inmediatamente
    e.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
    );
});

// Limpia cachés antiguos que se quedaron atrapados en la app (como poesia-v1)
self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keyList => {
            return Promise.all(
                keyList.map(key => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key); // Orden de autodestrucción
                    }
                })
            );
        }).then(() => self.clients.claim()) // Toma control de la app al instante
    );
});

// Estrategia "Network First" (Primero Red, luego Caché) para actualizaciones en tiempo real
self.addEventListener('fetch', e => {
    // Si no es una petición GET estándar, la dejamos pasar normal
    if (e.request.method !== 'GET') return;
    
    e.respondWith(
        fetch(e.request)
            .then(response => {
                // Si la red responde bien, guardamos una copia fresca en caché y devolvemos la página nueva
                let responseClone = response.clone();
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(e.request, responseClone);
                });
                return response;
            })
            .catch(() => {
                // Si la red falla (sin internet modo avión), servimos dignamente desde la caché guardada
                return caches.match(e.request);
            })
    );
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
