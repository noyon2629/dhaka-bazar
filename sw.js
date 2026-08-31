const CACHE_NAME = "dhaka-bazar-v1";

const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  // API request হলে সরাসরি network ব্যবহার করবে
  if (request.url.includes("/api/")) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(
          JSON.stringify({
            success: false,
            message: "Internet connection unavailable"
          }),
          {
            headers: {
              "Content-Type": "application/json"
            }
          }
        );
      })
    );
    return;
  }

  // Website files: network first, cache fallback
  event.respondWith(
    fetch(request)
      .then(response => {

        if (response && response.status === 200) {
          const responseClone = response.clone();

          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(request, responseClone);
            });
        }

        return response;
      })
      .catch(() => {
        return caches.match(request)
          .then(cachedResponse => {

            if (cachedResponse) {
              return cachedResponse;
            }

            return caches.match("./index.html");
          });
      })
  );
});
