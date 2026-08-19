const CACHE_NAME = 'revendit-v12';
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
  const req = event.request;

  // Solo manejamos GET. Cualquier otra cosa (POST a Firebase, etc.) pasa derecho.
  if (req.method !== 'GET') return;

  // No tocar las llamadas a Firebase ni a servicios externos: siempre a la red.
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const esHTML = (
    req.mode === 'navigate' ||
    req.url.includes('index.html') ||
    req.url.endsWith('/')
  );

  if (esHTML) {
    // ESTRATEGIA: stale-while-revalidate.
    //
    // Antes era network-first: en CADA visita el celular volvia a descargar el
    // index.html entero (~730 KB) antes de mostrar nada, aunque ya lo tuviera
    // guardado. Con buena señal se notaba lento; con señal floja la descarga se
    // colgaba y el cliente veia una pantalla en blanco ("no abre").
    //
    // Ahora: se responde AL INSTANTE con la copia guardada y, en paralelo, se
    // baja la version nueva para la proxima vez. La app ya tiene un listener de
    // 'controllerchange' que recarga sola cuando detecta una version nueva, asi
    // que las actualizaciones siguen llegando igual, solo que sin bloquear la
    // primera pintura de la pantalla.
    event.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        cache.match('/index.html').then(cached => {
          const redDePaso = fetch(req).then(resp => {
            // Guardar la version nueva para la proxima visita.
            if (resp && resp.status === 200) {
              cache.put('/index.html', resp.clone());
            }
            return resp;
          }).catch(() => null);

          // Si hay copia guardada -> mostrarla ya. Si no (primera visita) -> esperar la red.
          return cached || redDePaso.then(r => r || caches.match('/'));
        })
      )
    );
  } else {
    // Resto de recursos propios (iconos, manifest): cache-first, con refresco en segundo plano.
    event.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        cache.match(req).then(cached => {
          const redDePaso = fetch(req).then(resp => {
            if (resp && resp.status === 200) cache.put(req, resp.clone());
            return resp;
          }).catch(() => null);
          return cached || redDePaso;
        })
      )
    );
  }
});
