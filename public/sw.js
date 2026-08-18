self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// No se cachean conversaciones ni respuestas: el service worker solo habilita
// la experiencia instalable y deja que cada solicitud conserve su seguridad.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method === "GET" && url.origin === self.location.origin) {
    event.respondWith(fetch(event.request));
  }
});
