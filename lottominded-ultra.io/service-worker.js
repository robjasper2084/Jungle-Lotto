const SHELL_CACHE = "lottomind-shell-v3";
const PAGE_CACHE = "lottomind-pages-v3";
const ASSET_CACHE = "lottomind-assets-v3";
const CORE = ["./", "./index.html", "./styles.css", "./site.js", "./assets/brand/lm-orb-mark.webp"];
const MAX_PAGES = 12;
const MAX_ASSETS = 80;
const MAX_ASSET_BYTES = 3 * 1024 * 1024;
const CACHEABLE_DESTINATIONS = new Set(["font", "image", "manifest", "script", "style"]);
const CACHEABLE_EXTENSIONS = /\.(?:avif|css|gif|ico|jpe?g|js|json|mjs|png|svg|webmanifest|webp|woff2?)$/i;
const NEVER_CACHE_EXTENSIONS = /\.(?:aac|flac|m4a|mov|mp3|mp4|oga|ogv|pdf|wav|webm|zip)$/i;

async function trimCache(cacheName, limit) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= limit) return;
  await Promise.all(keys.slice(0, keys.length - limit).map((request) => cache.delete(request)));
}

function shouldBypass(request, url) {
  return request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.includes("/api/") ||
    request.headers.has("range") ||
    NEVER_CACHE_EXTENSIONS.test(url.pathname);
}

function isCacheableAsset(request, response, url) {
  if (!response || !response.ok || response.type === "opaque") return false;
  if (request.cache === "no-store" || request.cache === "reload") return false;
  if (!CACHEABLE_DESTINATIONS.has(request.destination) && !CACHEABLE_EXTENSIONS.test(url.pathname)) return false;
  const length = Number(response.headers.get("content-length") || 0);
  return !length || length <= MAX_ASSET_BYTES;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(CORE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  const keep = new Set([SHELL_CACHE, PAGE_CACHE, ASSET_CACHE]);
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => !keep.has(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (shouldBypass(request, url)) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            caches.open(PAGE_CACHE)
              .then((cache) => cache.put(request, response.clone()))
              .then(() => trimCache(PAGE_CACHE, MAX_PAGES));
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match("./index.html")))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (isCacheableAsset(request, response, url)) {
          caches.open(ASSET_CACHE)
            .then((cache) => cache.put(request, response.clone()))
            .then(() => trimCache(ASSET_CACHE, MAX_ASSETS));
        }
        return response;
      });
    })
  );
});
