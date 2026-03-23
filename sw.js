const CACHE_NAME = 'revendit-v1';
const ASSETS = [
      '/Minegocio/',
        '/Minegocio/index.html',
          '/Minegocio/manifest.json'
];

self.addEventListener('install', event => {
      event.waitUntil(
            caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS).catch(()=>{}))
      );
        self.skipWaiting();
});

self.addEventListener('activate', event => {
      event.waitUntil(
            caches.keys().then(keys =>
                  Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
                      )
      );
        self.clients.claim();
});

self.addEventListener('fetch', event => {
      if (event.request.url.includes('firestore.googleapis.com') ||
            event.request.url.includes('firebase') ||
                  event.request.url.includes('wa.me')) return;
                    event.respondWith(
                            fetch(event.request)
                                  .then(r => { caches.open(CACHE_NAME).then(c => c.put(event.request, r.clone())); return r; })
                                        .catch(() => caches.match(event.request))
                    );
});
                    )
})
      )
})
      )
})
]