const CACHE_NAME = 'revendit-v11';
const urlsToCache = [
  '/',
  '/index.html'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      // Activarse de inmediato, sin quedar "esperando" a que el cliente toque "Actualizar"
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', event => {
  // El HTML (navegación, '/', '/?tienda', index.html) SIEMPRE network-first:
  // así el cliente recibe la última versión apenas tiene conexión.
  if (
    event.request.mode === 'navigate' ||
    event.request.url.includes('index.html') ||
    event.request.url.endsWith('/')
  ) {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match('/index.html').then(r => r || caches.match('/'))
      )
    );
  } else {
    // El resto (íconos, etc.) cache-first
    event.respondWith(
      caches.match(event.request).then(r => r || fetch(event.request))
    );
  }
});
