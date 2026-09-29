/* Offline support. Bump VERSION on every deploy so phones pick up the new files. */
const VERSION = 'v1';
const CACHE = 'ef-' + VERSION;
const RUNTIME = 'ef-runtime';
const SHELL = [
  './',
  'index.html',
  'css/styles.css',
  'js/app.js',
  'js/sync.js',
  'js/firebase-config.js',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, {cache: 'reload'})))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('ef-v') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// cache-first, then network (and store the answer)
async function cacheFirst(req, cacheName){
  const hit = await caches.match(req, {ignoreSearch: req.mode === 'navigate'});
  if(hit) return hit;
  const res = await fetch(req);
  if(res && (res.ok || res.type === 'opaque')){
    const c = await caches.open(cacheName);
    c.put(req, res.clone());
  }
  return res;
}
// answer from cache immediately, refresh it in the background
async function staleWhileRevalidate(req){
  const c = await caches.open(RUNTIME);
  const hit = await c.match(req);
  const net = fetch(req).then(res => { if(res && (res.ok || res.type === 'opaque')) c.put(req, res.clone()); return res; }).catch(() => hit);
  return hit || net;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);

  if(url.origin === self.location.origin){
    const isPage = url.pathname.endsWith('/') || url.pathname.endsWith('/index.html');
    if(req.mode === 'navigate' && isPage){
      // the app shell always opens, with or without reception
      e.respondWith(caches.match('index.html').then(hit => hit || fetch(req)).catch(() => caches.match('index.html')));
      return;
    }
    e.respondWith(cacheFirst(req, CACHE));
    return;
  }
  // Heebo font files + Firebase SDK (versioned URLs, never change)
  if(url.hostname === 'fonts.gstatic.com' || (url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/'))){
    e.respondWith(cacheFirst(req, RUNTIME));
    return;
  }
  if(url.hostname === 'fonts.googleapis.com'){
    e.respondWith(staleWhileRevalidate(req));
  }
  // everything else (Firestore traffic etc.) goes straight to the network
});
