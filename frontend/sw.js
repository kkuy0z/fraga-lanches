const CACHE_NAME = "fraga-lanches-v4";

const ARQUIVOS = [
  "/inicio.html",
  "/manifest.json",
  "/design-system.css",
  "/responsive.css",
  "/telefone.js",
  "/cliente/painel.html",
  "/cliente/painel.js",
  "/cliente/cardapio.html",
  "/cliente/cardapio.js",
  "/cliente/carrinho.html",
  "/cliente/checkout.html",
  "/cliente/meus-pedidos.html",
  "/cliente/perfil.html",
  "/frontend/imagens/logo.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(ARQUIVOS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((nomes) =>
        Promise.all(
          nomes
            .filter((nome) => nome !== CACHE_NAME)
            .map((nome) => caches.delete(nome)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const requisicao = event.request;
  const url = new URL(requisicao.url);

  if (
    requisicao.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/")
  ) {
    return;
  }

  // Páginas HTML: nunca armazenar páginas privadas.
  if (requisicao.mode === "navigate") {
    event.respondWith(
      fetch(requisicao).catch(async () => {
        const paginaInicial = await caches.match("/inicio.html");

        return (
          paginaInicial ||
          new Response(
            "Você está offline. Conecte-se à internet para continuar.",
            {
              status: 503,
              headers: {
                "Content-Type": "text/plain; charset=utf-8",
              },
            },
          )
        );
      }),
    );

    return;
  }

  // Arquivos estáticos: rede primeiro, cache como alternativa.
  event.respondWith(
    fetch(requisicao)
      .then((resposta) => {
        if (resposta.ok && resposta.type === "basic") {
          const copia = resposta.clone();

          caches.open(CACHE_NAME).then((cache) => cache.put(requisicao, copia));
        }

        return resposta;
      })
      .catch(async () => {
        const arquivoSalvo = await caches.match(requisicao);

        if (arquivoSalvo) {
          return salva;
        }

        if (requisicao.mode === "navigate") {
          return caches.match("/inicio.html");
        }

        return new Response("", { status: 503 });
      }),
  );
});
