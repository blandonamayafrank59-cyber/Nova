// Service Worker de Nova.
//
// Notas para quien toque esto después:
// - Tailwind YA NO se carga desde ningún CDN -- el CSS quedó compilado e
//   incrustado directo en index.html (ver el comentario ahí). Por eso ya
//   no aparece en la lista de abajo: no hace falta guardarlo porque va
//   siempre pegado al propio HTML.
// - El HTML de la app (index.html / "/") usa "red primero": siempre intenta
//   la versión más nueva, y solo si no hay conexión usa la última copia
//   guardada. Así nunca se queda pegado en una versión vieja para siempre.
// - Las demás librerías externas (React, Babel, Chart.js, fuentes) se
//   guardan con fetch en modo "no-cors" explícito durante la instalación.
//
// Dos trabajos en total:
// 1) Guardar una copia de la app para poder ABRIRLA sin internet, CON estilos.
// 2) Mostrar las notificaciones push a los clientes con fiado.

const CACHE_NAME = "nova-shell-v5";
const SUPABASE_HOST = "fgfobmrhgcztvjaagxvu.supabase.co";
const RECURSOS_LIBRERIAS = [
  "https://unpkg.com/react@18.3.1/umd/react.production.min.js",
  "https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js",
  "https://unpkg.com/@babel/standalone@7.25.6/babel.min.js",
  "https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js",
  "https://fonts.googleapis.com/css2?family=Poppins:wght@600;700;800&family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@400;500;600&display=swap",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.add("./").catch(() => {});
      await cache.add("./index.html").catch(() => {});
      await cache.add("./manifest.json").catch(() => {});
      await Promise.all(
        RECURSOS_LIBRERIAS.map(async (url) => {
          try {
            const respuesta = await fetch(url, { mode: "no-cors", cache: "reload" });
            await cache.put(url, respuesta);
          } catch (e) { /* esa librería puntual queda sin cachear, no bloquea el resto */ }
        })
      );
    })()
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
  if (url.hostname.includes(SUPABASE_HOST)) return;

  const esNavegacion = event.request.mode === "navigate";
  const esElHtmlPrincipal = esNavegacion || url.pathname === "/" || url.pathname.endsWith("/index.html");

  if (esElHtmlPrincipal) {
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

  event.respondWith(
    caches.match(event.request).then((cacheado) => {
      if (cacheado) {
        fetch(event.request, { mode: event.request.mode === "cors" ? "cors" : "no-cors" })
          .then((resp) => caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resp)))
          .catch(() => {});
        return cacheado;
      }
      return fetch(event.request).then((respuesta) => {
        const copia = respuesta.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copia)).catch(() => {});
        return respuesta;
      });
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
