// Service Worker de Nova — solo se encarga de mostrar las notificaciones
// push que le llegan y abrir el link correcto al tocarlas. No cachea nada
// ni interfiere con el resto de la app.

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
