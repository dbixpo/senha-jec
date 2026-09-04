const CACHE = "senha-jec-v30";
const SHELL = [
  "./",
  "./index.html",
  "./css/app.css",
  "./js/app.js",
  "./js/config.js",
  "./js/pwa.js",
  "./img/favicon.svg",
  "./img/preferencial.png",
  "./img/pref/cadeira.png",
  "./img/pref/idoso.png",
  "./img/pref/gestante.png",
  "./img/pref/bebe.png",
  "./img/pref/obesidade.png",
  "./img/pref/autismo.png",
  "./img/icon-192.png",
  "./img/icon-512.png",
  "./manifest.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.protocol !== "http:" && url.protocol !== "https:") return;
  if (url.hostname.includes("supabase.co")) return;

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        return res;
      })
      .catch(() => caches.match(event.request).then((hit) => hit || caches.match("./index.html")))
  );
});
