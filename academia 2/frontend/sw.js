// Academia LMS Service Worker
const CACHE_NAME = 'academia-lms-v1';
const urlsToCache = [
  '/frontend/',
  '/frontend/index.html',
  '/frontend/login.html',
  '/frontend/dashboard.html',
  '/frontend/CSS/style.css',
  '/frontend/CSS/auth.css',
  '/frontend/CSS/dashboard.css',
  '/frontend/js/auth.js',
  '/frontend/js/dashboard.js',
  '/frontend/js/courses.js',
  '/frontend/js/attendance.js',
  '/frontend/assets/logo.png',
  '/frontend/manifest.json'
];

// Install event - cache core files
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

// Fetch event - cache-first for static, network-first for API
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // API calls - network first, cache if offline
  if (url.origin === location.origin && url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }
  
  // Static assets - cache first
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request)
        .then(fetchResponse => {
          return caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, fetchResponse.clone());
            return fetchResponse;
          });
        })
      )
      .catch(() => caches.match('/frontend/dashboard.html')) // Offline fallback
  );
});

// Activate - clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

