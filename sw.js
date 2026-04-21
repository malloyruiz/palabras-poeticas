const CACHE_NAME = 'lumina-v16'; // v16: Integración de Telegram

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
    
    // EXCLUSIÓN: No cachear peticiones a la API de Google Apps Script (Contenido Dinámico)
    if (e.request.url.includes('script.google.com')) {
        return; // El navegador manejará la petición directamente de la red
    }

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
  if (event.data && event.data.type === 'UPDATE_ACTIVITY') {
     const cachePromise = caches.open(CACHE_NAME).then(cache => {
        return cache.put('last-activity-ts', new Response(Date.now().toString()));
     });
     event.waitUntil(cachePromise);
  }
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
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

  // --- NOTIFICACIÓN DE RETENCIÓN (TE ECHAMOS DE MENOS) ---
  try {
     const lastActivity = await cache.match('last-activity-ts');
     if (lastActivity) {
        const lastTs = parseInt(await lastActivity.text());
        const diffDays = Math.round((Date.now() - lastTs) / (1000 * 60 * 60 * 24));
        if (diffDays >= 3) {
           self.registration.showNotification('Lúmina: Te echamos de menos', {
               body: 'Un momento de paz te espera para renovar tu energía. Tu senda continúa aquí.',
               icon: 'icon-192.png',
               badge: 'icon-192.png',
               tag: 'retention'
           });
        }
     }
  } catch (e) { console.warn("Retention check failed", e); }
}

// Escuchar el clic sobre una notificación y abrir la PWA en la pestaña correcta
self.addEventListener('notificationclick', function(event) {
    event.notification.close(); // Cierra la notificación

    // Extraer la ruta base usando el "tag" que mandamos desde index.html (ej: "libros:abcxyz" -> "#libros")
    const hashRoute = event.notification.tag ? '#' + event.notification.tag.split(':')[0] : '#hub';
    const urlToOpen = new URL('/', self.location.origin).href + hashRoute;

    const promiseChain = clients.matchAll({
        type: 'window',
        includeUncontrolled: true
    }).then((windowClients) => {
        let matchingClient = null;

        for (let i = 0; i < windowClients.length; i++) {
            const windowClient = windowClients[i];
            // Si la PWA ya está abierta en alguna ventana, la enfocamos y cambiamos el hash
            if (windowClient.url.includes(self.location.origin)) {
                matchingClient = windowClient;
                break;
            }
        }

        if (matchingClient) {
            matchingClient.navigate(urlToOpen); // Fuerza a la app a rutear a la categoría correcta
            return matchingClient.focus();
        } else {
            // Si la app está completamente cerrada, abrimos una nueva ventana/instancia
            return clients.openWindow(urlToOpen);
        }
    });

    event.waitUntil(promiseChain);
});
