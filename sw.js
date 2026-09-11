const CACHE = 'codex-battle-v1';
const urls = [
  'index.html',
  'css/style.css',
  'js/srs.js',
  'js/storage.js',
  'js/modManager.js',
  'js/battle.js',
  'js/deck.js',
  'js/cinematic.js',
  'js/app.js',
  'manifest.json'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(urls)));
  self.skipWaiting();
});

self.addEventListener('activate', e => e.waitUntil(clients.claim()));

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
