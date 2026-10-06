/*
 * Service worker: az app „héja” (oldal, ikonok, betűtípus) offline is betölt.
 * Az eseményadatokat maga az oldal menti a telefonra (localStorage), azokat itt nem kezeljük.
 * Új verzió kiadásakor elég a VERSION értékét növelni.
 */
const VERSION = 'v1';
const SHELL = `shell-${VERSION}`;
const FONTS = 'fonts-v1';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== SHELL && k !== FONTS).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // betűtípus: cache először (ritkán változik)
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(FONTS).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok || res.type === 'opaque') c.put(req, res.clone());
      return res;
    }));
    return;
  }

  // csak a saját fájljainkat kezeljük; az adat-API (script.google.com) mindig a hálózatról jön
  if (url.origin !== location.origin) return;

  // az oldal: hálózat először (mindig a legfrissebb verzió), offline a mentett
  e.respondWith(
    fetch(req)
      .then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(SHELL).then(c => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || caches.match('./index.html')))
  );
});
