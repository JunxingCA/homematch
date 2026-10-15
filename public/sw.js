/* Only these public, credential-free files may enter the offline cache. */
const CACHE_PREFIX = "homematch-offline-";
const CACHE_NAME = `${CACHE_PREFIX}v2`;
const OFFLINE_URL = "/pwa/offline.html";
const ASSETS = [
  OFFLINE_URL,
  "/pwa/offline.css",
  "/pwa/offline.js",
  "/homematch-logo.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      for (const path of ASSETS) {
        const response = await fetch(path, {
          credentials: "omit",
          cache: "reload",
          redirect: "error",
        });
        if (!response.ok || response.type !== "basic" || response.redirected)
          throw new Error("Offline assets unavailable");
        await cache.put(path, response);
      }
      // Updates wait for the user to approve a reload. No automatic skipWaiting.
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "ACTIVATE_UPDATE")
    event.waitUntil(self.skipWaiting());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  // APIs, RSC requests, mutations, tiles, providers and bundles pass through untouched.
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (
    url.pathname === "/api" ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_next/")
  )
    return;
  if (!url.search && ASSETS.includes(url.pathname)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match(url.pathname)) || fetch(request);
      })(),
    );
  } else if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch {
          const cache = await caches.open(CACHE_NAME);
          const fallback = await cache.match(OFFLINE_URL);
          return (
            fallback ||
            new Response(
              "HomeMatch needs an internet connection. Please reconnect and open HomeMatch again.",
              {
                status: 503,
                headers: {
                  "Content-Type": "text/plain; charset=utf-8",
                  "Cache-Control": "no-store",
                },
              },
            )
          );
        }
      })(),
    );
  }
});
