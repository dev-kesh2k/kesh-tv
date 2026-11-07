// Service worker do Kesh TV: guarda o app (telas, scripts, ícones) para abrir rápido e sem internet.
// Nunca guarda a API, streams ou logos (dados mudam e podem ser grandes).
const CACHE = 'kesh-tv-app-v1';
const SCOPE = new URL(self.registration.scope).pathname; // ex.: /kesh-tv/

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll([SCOPE, `${SCOPE}icon.svg`, `${SCOPE}manifest.webmanifest`])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('kesh-tv-app-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || !url.pathname.startsWith(SCOPE)) return;
  if (url.pathname.startsWith(`${SCOPE}api/`)) return;

  // Telas: rede primeiro (traz atualizações), cópia guardada se estiver sem internet.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(SCOPE, copy));
          return res;
        })
        .catch(() => caches.match(SCOPE)),
    );
    return;
  }

  // Scripts/estilos com hash no nome e ícones: cache primeiro.
  if (/\/assets\/|\.(svg|png|webmanifest)$/.test(url.pathname)) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
  }
});
