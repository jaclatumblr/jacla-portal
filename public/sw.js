const VERSION = "v1";
const CACHE_PREFIX = "jacla-pwa";
const SHELL_CACHE = `${CACHE_PREFIX}-shell-${VERSION}`;
const RUNTIME_CACHE = `${CACHE_PREFIX}-runtime-${VERSION}`;
const OFFLINE_URL = "/offline";
const APP_SHELL_ASSETS = [
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/favicon.ico",
  "/images/jacla-logo.png",
  "/pwa/icon-192.png",
  "/pwa/icon-512.png",
  "/pwa/maskable-icon-512.png",
  "/pwa/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL_ASSETS))
      .catch(() => undefined)
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                key.startsWith(CACHE_PREFIX) &&
                key !== SHELL_CACHE &&
                key !== RUNTIME_CACHE
            )
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

const shouldBypassRequest = (request, url) => {
  if (request.method !== "GET") return true;
  if (url.origin !== self.location.origin) return true;
  if (url.pathname.startsWith("/api/")) return true;
  if (url.pathname.startsWith("/auth/")) return true;
  if (url.pathname.startsWith("/_next/webpack-hmr")) return true;
  return false;
};

const putInCache = async (cacheName, request, response) => {
  if (!response || response.status !== 200 || response.type === "opaque") return response;
  const cache = await caches.open(cacheName);
  cache.put(request, response.clone());
  return response;
};

const networkFirst = async (request) => {
  try {
    const response = await fetch(request);
    return putInCache(RUNTIME_CACHE, request, response);
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return caches.match(OFFLINE_URL);
  }
};

const staleWhileRevalidate = async (request) => {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);

  const networkPromise = fetch(request)
    .then((response) => putInCache(RUNTIME_CACHE, request, response))
    .catch(() => undefined);

  if (cached) {
    return cached;
  }

  return networkPromise;
};

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (shouldBypassRequest(request, url)) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  const isStaticAsset =
    url.pathname.startsWith("/_next/static/") ||
    /\.(?:css|js|mjs|png|jpg|jpeg|gif|webp|svg|ico|woff2?)$/i.test(url.pathname);

  if (isStaticAsset) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  event.respondWith(networkFirst(request));
});
