const CACHE = "client-totals-shell-v5";

const CORE_ASSETS = [
  "./",
  "./index.html",
  "./app.js",
  "./style.css",
  "./manifest.json"
];

// install
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(CORE_ASSETS))
  );
});

// activate
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE)
          .map((key) => caches.delete(key))
      )
    ).then(() => clients.claim())
  );
});

// fetch
self.addEventListener("fetch", (event) => {
  const req = event.request;

  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // მხოლოდ იგივე origin-ზე ვმუშაობთ
  if (url.origin !== location.origin) {
    return;
  }

  // HTML / navigation -> network first
  if (
  req.mode === "navigate" ||
  url.pathname.endsWith(".html") ||
  url.pathname === "/" ||
  url.pathname === ""
) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() =>
          caches.match(req).then((cached) => cached || caches.match("./index.html"))
        )
    );
    return;
  }

  // CSS / JS / manifest -> stale while revalidate
  if (
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".json")
  ) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const networkFetch = fetch(req)
          .then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
            return res;
          })
          .catch(() => cached);

        return cached || networkFetch;
      })
    );
    return;
  }

  // დანარჩენი -> cache first
  event.respondWith(
    caches.match(req).then((cached) => {
      return (
        cached ||
        fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
          return res;
        })
      );
    })
  );
});

// skip waiting message
self.addEventListener("message", (event) => {
  if (event.data && event.data.action === "skipWaiting") {
    self.skipWaiting();
  }

});




