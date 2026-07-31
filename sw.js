const CACHE_NAME = 'sporia-cache-v2';

// 1. App-filer som alltid skal ligge lokalt
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Installasjon: Lagre app-skallet (HTML, ikoner osv.)
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Aktivering: Slett eventuelt gamle cache-versjoner
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch: Håndter trafikk fra appen (inkludert Supabase Storage "dog-photos")
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // 1. Ignorer endringer mot selve Supabase-databasen (REST-API calls), 
  // slik at vi alltid prøver å hente rykende ferske hundefiler fra nett.
  if (url.pathname.includes('/rest/v1/')) {
    return; 
  }

  // 2. ER DET ET BILDE FRA "DOG-PHOTOS" STORAGE?
  // Strategi: Network-first med cache som fallback (Hent nytt fra nett, lagre kopi)
  if (url.pathname.includes('/storage/v1/object/public/dog-photos/')) {
    e.respondWith(
      fetch(e.request)
        .then((networkResponse) => {
          // Hvis vi fikk bildet fra nettet: Lagre/oppdater en kopi i cachen
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(e.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Hvis mobilen er offline, prøv å vise bildet fra cache
          return caches.match(e.request);
        })
    );
    return;
  }

  // 3. VANLIGE APP-FILER (index.html, ikoner osv.)
  // Strategi: Stole på cache først for at appen skal være lynrask, hent fra nett om den mangler
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      return cachedResponse || fetch(e.request);
    })
  );
});