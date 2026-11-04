const CACHE_NAME = "latakia-cafeteria-v5";
const CORE_FILES = ["./", "./index.html", "./styles.css", "./script.js", "./theme-init.js", "./menu-data.json", "./manifest.webmanifest", "./Cairo-Regular.woff2", "./favicon.svg", "./favicon-32.png", "./apple-touch-icon.png", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", (event) => {
    event.waitUntil(caches.open(CACHE_NAME).then((cache) => Promise.allSettled(CORE_FILES.map((file) => cache.add(file)))));
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))));
    self.clients.claim();
});

self.addEventListener("fetch", (event) => {
    if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
    const request = event.request;
    if (request.mode === "navigate" || new URL(request.url).pathname.endsWith("/menu-data.json")) {
        event.respondWith(fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            return response;
        }).catch(() => caches.match(request).then((cached) => cached || caches.match("./index.html"))));
        return;
    }
    event.respondWith(caches.match(request).then((cached) => {
        const network = fetch(request).then((response) => {
            caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
            return response;
        }).catch(() => cached);
        return cached || network;
    }));
});
