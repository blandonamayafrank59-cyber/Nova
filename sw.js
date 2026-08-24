// Service Worker de Nova — permite abrir la app sin internet, incluso después
// de cerrarla o reiniciar el teléfono, siempre que se haya abierto una vez
// con conexión antes.
const CACHE_NAME = "nova-app-shell-v1";

const ARCHIVOS_APP = [
  "./",
  "./index.html",
  "https://cdn.tailwindcss.com",
  "https://unpkg.com/react@18.3.1/umd/react.production.min.js",
  "https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js",
  "https://unpkg.com/@babel/standalone@7.25.6/babel.min.js",
  "https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js",
  "https://fonts.googleapis.com/css2?family=Poppins:wght@600;700;800&family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@400;500;600&display=swap",
];

self.addEventListener("install", (evento) => {
  self.skipWaiting();
  evento.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        ARCHIVOS_APP.map((url) =>
          fetch(url, { mode: url.startsWith("http") ? "no-cors" : "same-origin" })
            .then((res) => cache.put(url, res))
            .catch(() => {}) // si algo no se pudo guardar, seguimos sin romper la instalación
        )
      )
    )
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches.keys().then((claves) =>
      Promise.all(claves.filter((c) => c !== CACHE_NAME).map((c) => caches.delete(c)))
    )
  );
  self.clients.claim();
});

// Estrategia: intenta traer la versión más nueva de internet; si no hay
// conexión, sirve la copia guardada. Así, con internet siempre ves lo último,
// y sin internet la app igual abre.
self.addEventListener("fetch", (evento) => {
  if (evento.request.method !== "GET") return;

  evento.respondWith(
    fetch(evento.request)
      .then((respuestaRed) => {
        const copia = respuestaRed.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(evento.request, copia)).catch(() => {});
        return respuestaRed;
      })
      .catch(() =>
        caches.match(evento.request).then((respuestaCache) => {
          if (respuestaCache) return respuestaCache;
          // Si piden la página principal y no hay nada guardado, mostramos el index cacheado
          if (evento.request.mode === "navigate") return caches.match("./index.html");
          return new Response("", { status: 408, statusText: "Sin conexión" });
        })
      )
  );
});
