const VERSION = "v2";
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
  if (request.headers.has("authorization") || request.headers.has("rsc") || url.searchParams.has("_rsc")) return true;
  return false;
};

const putInCache = async (cacheName, request, response) => {
  if (!response || response.status !== 200 || response.type === "opaque") return response;
  if (/\b(?:private|no-store)\b/i.test(response.headers.get("cache-control") ?? "")) return response;
  try {
    const cache = await caches.open(cacheName);
    await cache.put(request, response.clone());
  } catch { /* A full or disabled cache must not break successful requests. */ }
  return response;
};

const networkFirst = async (request) => {
  try {
    const response = await fetch(request);
    // Never persist page responses: they may depend on the signed-in account.
    return response;
  } catch {
    try { return await caches.match(OFFLINE_URL) || Response.error(); }
    catch { return Response.error(); }
  }
};

const staleWhileRevalidate = async (request, event) => {
  let cached;
  try {
    const cache = await caches.open(RUNTIME_CACHE);
    cached = await cache.match(request);
  } catch { /* Continue through the network when browser cache is unavailable. */ }

  const networkPromise = fetch(request)
    .then((response) => putInCache(RUNTIME_CACHE, request, response))
    .catch(() => undefined);
  event.waitUntil(networkPromise);

  if (cached) {
    return cached;
  }

  return await networkPromise || Response.error();
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
    url.pathname.startsWith("/images/") ||
    url.pathname.startsWith("/fonts/") ||
    url.pathname.startsWith("/pwa/") ||
    APP_SHELL_ASSETS.includes(url.pathname);

  if (isStaticAsset) {
    event.respondWith(staleWhileRevalidate(request, event));
    return;
  }

  // Other data requests use the browser network path, never a shared cache.
});
