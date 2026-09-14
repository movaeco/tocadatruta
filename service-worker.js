/* Service Worker — Toca da Truta
   Guarda o "esqueleto" do app (HTML, ícones, manifest) em cache pra abrir
   rápido e continuar dando pra usar mesmo com internet ruim. Os dados de
   comandas continuam sincronizando pelo Firestore normalmente quando
   houver conexão — isso aqui só cuida dos arquivos do próprio app. */

const CACHE_NAME = "toca-da-truta-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/icon-180.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Só cuida de requisições GET dentro do próprio app (mesma origem).
  // Chamadas ao Firestore, CDNs de PDF etc. seguem direto pra rede,
  // sem passar pelo cache — não queremos guardar dados desatualizados.
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  // Navegação (abrir o app): tenta a rede primeiro pra sempre pegar a
  // versão mais nova; se não tiver internet, cai pro que está em cache.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("./index.html", clone));
          return res;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  // Demais arquivos do app (ícones, manifest): cache primeiro, com
  // atualização em segundo plano.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req).then((res) => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
