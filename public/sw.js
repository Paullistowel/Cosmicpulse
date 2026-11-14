/* CosmicPulse offline service worker.
 * - Precaches every app route and the editorial images on install.
 * - Static build assets (/_next/static): cache-first (content-hashed).
 * - Pages: network-first, falling back to the cached copy (works in LOS).
 * - /api/osdr: stale-while-revalidate so research search results stay available.
 * - /api/ground: never cached (authenticated, health data).
 * Health data itself lives in the encrypted IndexedDB vault, not here.
 */
const VERSION = 'cp-v4';
const SHELL = `${VERSION}-shell`;
const RUNTIME = `${VERSION}-runtime`;
const ROUTES = ['/', '/intro', '/welcome', '/twin', '/sentinel', '/simulator', '/timeline', '/missions', '/achievements', '/station', '/vitals', '/vitals/heart_rate', '/vitals/blood_pressure', '/vitals/spo2', '/vitals/temperature', '/vitals/respiratory_rate', '/vitals/hrv', '/research/osd-575', '/research/nasa-hrp-hazards', '/analytics', '/sleep', '/activity', '/wellness', '/assistant', '/alerts', '/assessments', '/risk', '/risk/radiation', '/risk/isolation', '/risk/distance', '/risk/gravity', '/risk/environment', '/research', '/record', '/history', '/medical', '/reports', '/settings', '/emergency'];
const ASSETS = ['/models/anatomy.glb', '/images/twin/body-preview.png', '/brand/cosmicpulse-logo.png', '/media/intro.mp4', '/media/intro-poster.jpg', '/images/eva-hero.jpg', '/images/visor.jpg', '/images/earth-orbit.jpg', '/images/moon-limb.jpg', '/images/eva-suit.jpg', '/icon-192.png', '/manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(SHELL).then(async (c) => {
      await Promise.all(ASSETS.map((u) => c.add(new Request(u, { cache: 'reload' })).catch(() => {})));
      // Cache each route's HTML and every build asset it references, so pages hydrate offline
      // even if they were never visited online.
      const assets = new Set();
      await Promise.all(
        ROUTES.map(async (u) => {
          try {
            const res = await fetch(new Request(u, { cache: 'reload' }));
            if (!res.ok) return;
            const html = await res.clone().text();
            await c.put(u, res);
            for (const m of html.matchAll(/["'(](\/_next\/static\/[^"')\s]+)/g)) assets.add(m[1]);
          } catch {}
        }),
      );
      await Promise.all([...assets].map((a) => c.add(a).catch(() => {})));
    }).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/ground')) return;

  // Video is fetched in byte ranges (206), which the Cache API can't store: network first,
  // falling back to the full file precached at install when offline.
  if (url.pathname.startsWith('/media/')) {
    e.respondWith(fetch(req).catch(async () => (await caches.match(url.pathname)) || new Response('', { status: 503 })));
    return;
  }
  if (url.pathname.startsWith('/_next/static') || url.pathname.startsWith('/images/') || url.pathname.startsWith('/models/') || url.pathname.startsWith('/_next/image')) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(RUNTIME).then((c) => c.put(req, copy)); } return res; })));
    return;
  }
  // Next.js client-navigation payloads (RSC): network-first, cached copy offline.
  if (url.searchParams.has('_rsc') || req.headers.get('rsc') === '1') {
    e.respondWith(fetch(req).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(RUNTIME).then((c) => c.put(req, copy)); } return res; }).catch(async () => (await caches.match(req)) || new Response('', { status: 503 })));
    return;
  }
  if (url.pathname.startsWith('/api/osdr')) {
    e.respondWith(caches.open(RUNTIME).then(async (c) => {
      const hit = await c.match(req);
      const net = fetch(req).then((res) => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }
  if (req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html')) {
    e.respondWith(fetch(req).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(RUNTIME).then((c) => c.put(req, copy)); } return res; }).catch(async () => (await caches.match(req)) || (await caches.match(url.pathname)) || (await caches.match('/')) || new Response('Offline', { status: 503 })));
  }
});
