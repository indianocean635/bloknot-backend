const CACHE_NAME = "bloknot-pwa-v5";

const APP_SHELL = [
  "/styles.css",
  "/app.js",
  "/logo-wordmark.svg?v=10",
  "/favicon.png",
  "/manifest.webmanifest",
  "/icons/icon-192.svg",
  "/icons/icon-512.svg",
  "/icons/icon-maskable.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Never cache API calls and auth flows
  if (req.url.includes("/api/")) return;

  // Only block direct /auth/ calls (not /api/auth/)
  if (req.url.includes("/auth/") && !req.url.includes("/api/")) return;

  if (req.method !== "GET") return;

  // Network-first strategy for HTML pages to always get fresh content
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // Cache the fresh response for offline use
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone)).catch(() => {});
          return res;
        })
        .catch(() => {
          // If network fails, try cache
          return caches.match(req);
        })
    );
    return;
  }

  // Only cache same-origin static assets.
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Network-first for CSS and JS files to ensure updates
  if (req.url.endsWith('.css') || req.url.endsWith('.js')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Cache-first for other static assets (images, icons)
  event.respondWith(
    caches.match(req).then((cached) =>
      cached ||
      fetch(req)
        .then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone)).catch(() => {});
          return res;
        })
        .catch(() => cached)
    )
  );
});
