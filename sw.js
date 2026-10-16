/* CTG Tools service worker. Bump CACHE_VERSION with every release
   (tests check it matches CTG_VERSION in navbar.js). All paths are
   relative to this file, so it works at a domain root, a Databricks
   app path, or a GitHub Pages sub-path. */
var CACHE_VERSION = 'v2.3.2';
var CACHE = 'ctg-tools-' + CACHE_VERSION;
var PRECACHE = [
  './', 'index.html', 'shell-control-correlation.html', 'shell-control-value-calculator.html',
  'slurry-calculator.html', 'tank-rpm-calculator.html', 'biocide-calculator.html',
  'ctg.css', 'calc.js', 'navbar.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-192.png', 'icons/maskable-512.png',
  'icons/apple-touch-icon.png', 'icons/favicon-32.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return c.addAll(PRECACHE.map(function (u) { return new Request(u, { cache: 'reload' }); }));
  }));
  // do not skipWaiting automatically: the page shows an "Update" prompt
});

self.addEventListener('message', function (e) {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('ctg-tools-') === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(caches.open(CACHE).then(function (c) {
    return c.match(req, { ignoreSearch: true }).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        if (res && res.ok && res.type === 'basic') c.put(req, res.clone());
        return res;
      }).catch(function () {
        if (req.mode === 'navigate') return c.match('index.html');
        return Response.error();
      });
    });
  }));
});
