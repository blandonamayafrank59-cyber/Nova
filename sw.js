// Service Worker de Nova.
//
// IMPORTANTE sobre la estrategia de caché (para el propio Claude, si esto
// se vuelve a tocar en el futuro):
// - El HTML de la app (index.html / "/") usa "red primero": siempre intenta
//   traer la versión más nueva del servidor, y solo si no hay conexión usa
//   la última copia guardada. Así, cada vez que Claude publique un cambio,
//   el negocio lo ve apenas tenga señal -- nunca se queda pegado en una
//   versión vieja para siempre (ese fue un bug real que causó horas de
//   confusión: parecía que los arreglos "no llegaban").
// - Las librerías (React, Tailwind, Chart.js, fuentes) sí usan "caché
//   primero", porque esas casi no cambian y así la app abre más rápido.
//
// Dos trabajos en total:
// 1) Guardar una copia de la app para poder ABRIRLA sin internet.
// 2) Mostrar las notificaciones push a los clientes con fiado.

const CACHE_NAME = "nova-shell-v3";
const SUPABASE_HOST = "fgfobmrhgcztvjaagxvu.supabase.co";
const RECURSOS_LIBRERIAS = [
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
      Promise.all([
        cache.add("./").catch(() => {}),
        cache.add("./index.html").catch(() => {}),
        cache.add("./manifest.json").catch(() => {}),
        ...RECURSOS_LIBRERIAS.map((url) => cache.add(url).catch(() => {})),
      ])
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

  // La base de datos nunca pasa por acá -- eso ya lo maneja el propio
  // código de Nova con su sistema de guardado local.
  if (url.hostname.includes(SUPABASE_HOST)) return;

  const esNavegacion = event.request.mode === "navigate";
  const esElHtmlPrincipal = esNavegacion || url.pathname === "/" || url.pathname.endsWith("/index.html");

  if (esElHtmlPrincipal) {
    // RED PRIMERO: siempre busca la versión más nueva. Solo si no hay
    // conexión (o el servidor no contesta) usa la última copia guardada.
    event.respondWith(
      fetch(event.request)
        .then((respuesta) => {
          if (respuesta && respuesta.status === 200) {
            const copia = respuesta.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copia)).catch(() => {});
          }
          return respuesta;
        })
        .catch(() => caches.match(event.request).then((c) => c || caches.match("./")))
    );
    return;
  }

  // Todo lo demás (librerías, fuentes): caché primero, y se actualiza
  // solo en segundo plano -- no cambian seguido, priorizamos velocidad.
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
