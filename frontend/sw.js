
const CACHE_NAME = "fraga-lanches-v2";

const ARQUIVOS = [
    "/inicio.html",
    "/manifest.json",
    "/design-system.css",
    "/cliente/painel.html",
    "/cliente/painel.js",
    "/cliente/cardapio.html",
    "/cliente/cardapio.js",
    "/cliente/carrinho.html",
    "/cliente/checkout.html",
    "/cliente/meus-pedidos.html",
    "/cliente/perfil.html",
    "/assets/images/icons/logo.png"
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ARQUIVOS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys()
            .then(nomes =>
                Promise.all(
                    nomes
                        .filter(nome => nome !== CACHE_NAME)
                        .map(nome => caches.delete(nome))
                )
            )
            .then(() => self.clients.claim())
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

    event.respondWith(
        fetch(requisicao)
            .then(resposta => {
                if (resposta.ok) {
                    const copia = resposta.clone();

                    caches.open(CACHE_NAME)
                        .then(cache => cache.put(requisicao, copia));
                }

                return resposta;
            })
            .catch(async () => {
                const salva = await caches.match(requisicao);

                if (salva) {
                    return salva;
                }

                if (requisicao.mode === "navigate") {
                    return caches.match("/inicio.html");
                }

                return new Response("", { status: 503 });
            })
    );
});
