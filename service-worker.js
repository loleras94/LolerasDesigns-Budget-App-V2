const CACHE_NAME = 'budget-app-cache-v1';
const URLS_TO_CACHE = [
  '/',
  '/index.html',
  '/assets/index-CRByhzqf.js',    // Point to your built JS file
  '/assets/index-poJZxa4j.css',   // Point to your built CSS file
  '/assets/icon-192-DnlUDWXX.svg',
  '/assets/icon-512-DnlUDWXX.svg',
  '/assets/manifest-C2EEhZK2.json', // Manifest file
  // Locales if needed, and images/fonts
  '/LolerasDesigns-Budget-App-V2/locales/en.json',
  '/LolerasDesigns-Budget-App-V2/locales/el.json',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache and caching assets');
        return cache.addAll(URLS_TO_CACHE);
      })
      .catch(error => {
        console.error('Failed to cache assets during install:', error);
      })
  );
});

self.addEventListener('fetch', event => {
  // We only want to cache GET requests.
  if (event.request.method !== 'GET') {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          // Cache hit - return response
          return response;
        }

        // Not in cache - fetch from network, and cache it for next time.
        return fetch(event.request).then(
          (networkResponse) => {
            // Check if we received a valid response
            if(!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic' && networkResponse.type !== 'cors') {
              return networkResponse;
            }

            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return networkResponse;
          }
        );
      })
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
