// PWA Service Worker - Fixed Offline
const CACHE_NAME = 'maseno-lms-v1';
const staticAssets = [
  './',
  'index.html',
  'login.html',
  'dashboard.html',
  'CSS/style.css',
  'CSS/auth.css',
  'CSS/dashboard.css',
  'js/auth.js',
  'js/dashboard.js',
  'assets/logo.png',
  'manifest.json',
  'offline.html'
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(staticAssets))
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(cacheNames => Promise.all(
      cacheNames.map(name => name !== CACHE_NAME && caches.delete(name))
    ))
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  
  // API - network falling back to cache
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(
      fetch(e.request).catch(() => {
        // Offline API fallback notice in JS
        return new Response(JSON.stringify({message: 'Offline - API unavailable'}), {
          status: 503,
          headers: {'Content-Type': 'application/json'}
        });
      })
    );
    return;
  }
  
  // Static - cache with network update
    e.respondWith(
    caches.open(CACHE_NAME).then(cache => 
      cache.match(e.request).then(cached => 
        fetch(e.request).then(network => {
          if (e.request.method === 'GET') {
            cache.put(e.request, network.clone());
          }
          return network;
        }).catch(() => cached || caches.match('./offline.html'))
      )
    )
  );
});
