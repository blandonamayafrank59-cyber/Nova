// Service Worker de Nova.
// Tiene dos trabajos:
// 1) Guardar una copia de la aplicación (HTML, React, Tailwind, fuentes)
//    la primera vez que se abre con internet, para poder ABRIR Nova aunque
//    no haya señal (esto es lo que faltaba: los datos ya funcionaban
//    offline, pero la app en sí necesitaba internet para siquiera cargar).
// 2) Mostrar las notificaciones push a los clientes con fiado.

const CACHE_NAME = "nova-shell-v2";
const SUPABASE_HOST = "fgfobmrhgcztvjaagxvu.supabase.co";

const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "https://cdn.tailwindcss.com",
  "https://unpkg.com/react@18.3.1/umd/react.production.min.js",
  "https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js",
  "https://unpkg.com/@babel/standalone@7.25.6/babel.min.js",
  "https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js",
  "https://fonts.googleapis.com/css2?family=Poppins:wght@600;700;800&family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@400;500;600&display=swap",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // Cada archivo se guarda por separado (no todo junto) para que si
      // uno falla (ej. una fuente), no arruine el resto -- lo importante,
      // el index.html, siempre queda guardado.
      Promise.all(APP_SHELL.map((url) => cache.add(url).catch(() => {})))
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((nombres) =>
      Promise.all(nombres.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  // Las llamadas a la base de datos (Supabase) NUNCA se sirven desde acá --
  // eso ya lo maneja el propio código de Nova con su sistema de guardado
  // local. Este service worker solo se encarga de que la APP pueda abrir.
  if (url.hostname.includes(SUPABASE_HOST)) return;

  event.respondWith(
    caches.match(event.request).then((cacheado) => {
      const desdeRed = fetch(event.request)
        .then((respuesta) => {
          if (respuesta && respuesta.status === 200) {
            const copia = respuesta.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copia)).catch(() => {});
          }
          return respuesta;
        })
        .catch(() => cacheado);
      // Si ya hay copia guardada, se muestra al toque (rápido) y de paso se
      // actualiza en segundo plano; si no hay copia, se espera a la red.
      return cacheado || desdeRed;
    })
  );
});

self.addEventListener("push", (event) => {
  let datos = { titulo: "Nova", cuerpo: "Tenés una actualización en tu cuenta.", url: "/" };
  try { datos = event.data.json(); } catch (e) {}
  event.waitUntil(
    self.registration.showNotification(datos.titulo || "Nova", {
      body: datos.cuerpo || "Tenés una actualización en tu cuenta.",
      icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='20' fill='%2316233D'/%3E%3Ctext x='50' y='68' font-size='55' text-anchor='middle' fill='%23E3A73B'%3E%E2%9C%A8%3C/text%3E%3C/svg%3E",
      badge: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='20' fill='%2316233D'/%3E%3C/svg%3E",
      data: { url: datos.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destino = event.notification.data?.url || "/";
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((lista) => {
      for (const c of lista) { if ("focus" in c) { c.navigate(destino); return c.focus(); } }
      if (clients.openWindow) return clients.openWindow(destino);
    })
  );
});
