
const CHAVE_CARRINHO = "fraga_carrinho";

const lista = document.getElementById("carrinhoLista");
const vazio = document.getElementById("carrinhoVazio");
const acoes = document.getElementById("carrinhoAcoes");

const subtotalElemento = document.getElementById("resumoSubtotal");
const taxaElemento = document.getElementById("resumoTaxaEntrega");
const descontoElemento = document.getElementById("resumoDesconto");
const totalElemento = document.getElementById("resumoTotal");

const botaoLimpar = document.getElementById("btnLimparCarrinho");
const botaoFinalizar = document.getElementById("btnFinalizar");

function obterCarrinho() {
    try {
        return JSON.parse(localStorage.getItem(CHAVE_CARRINHO)) || [];
    } catch {
        return [];
    }
}

function salvarCarrinho(carrinho) {
    localStorage.setItem(CHAVE_CARRINHO, JSON.stringify(carrinho));
}

function moeda(valor) {
    return Number(valor).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    });
}

function calcularSubtotal(carrinho) {
    return carrinho.reduce((total, item) => {
        const adicionais = (item.adicionais || []).reduce(
            (soma, adicional) => soma + Number(adicional.preco),
            0
        );

        return total + (
            (Number(item.preco) + adicionais) *
            Number(item.quantidade)
        );
    }, 0);
}

function renderizarCarrinho() {
    const carrinho = obterCarrinho();

    lista.innerHTML = "";

    if (carrinho.length === 0) {
        vazio.classList.remove("hidden");
        acoes.classList.add("hidden");
        botaoFinalizar.setAttribute("aria-disabled", "true");
        botaoFinalizar.style.pointerEvents = "none";
        botaoFinalizar.style.opacity = "0.5";
    } else {
        vazio.classList.add("hidden");
        acoes.classList.remove("hidden");
        botaoFinalizar.removeAttribute("aria-disabled");
        botaoFinalizar.style.pointerEvents = "";
        botaoFinalizar.style.opacity = "";
    }

    carrinho.forEach(item => {
        const artigo = document.createElement("article");
        artigo.className = "card";
        artigo.style.marginBottom = "16px";

        const conteudo = document.createElement("div");
        conteudo.className = "card-content";

        const nome = document.createElement("h3");
        nome.textContent = item.nome;

        const adicionais = document.createElement("p");
        adicionais.textContent = (item.adicionais || [])
            .map(adicional => adicional.nome)
            .join(", ") || "Sem adicionais";

        const precoUnitario = Number(item.preco) +
            (item.adicionais || []).reduce(
                (total, adicional) => total + Number(adicional.preco), 0
            );

        const preco = document.createElement("p");
        preco.textContent = `Preço unitário: ${moeda(precoUnitario)}`;

        const controles = document.createElement("div");
        controles.style.display = "flex";
        controles.style.alignItems = "center";
        controles.style.gap = "12px";
        controles.style.marginTop = "12px";

        const diminuir = document.createElement("button");
        diminuir.type = "button";
        diminuir.className = "btn btn-secondary";
        diminuir.textContent = "−";
        diminuir.setAttribute("aria-label", "Diminuir quantidade");

        diminuir.addEventListener("click", () => alterarQuantidade(item.chave, -1));

        const quantidade = document.createElement("strong");
        quantidade.textContent = item.quantidade;

        const aumentar = document.createElement("button");
        aumentar.type = "button";
        aumentar.className = "btn btn-secondary";
        aumentar.textContent = "+";
        aumentar.setAttribute("aria-label", "Aumentar quantidade");

        aumentar.addEventListener("click", () => alterarQuantidade(item.chave, 1));

        const remover = document.createElement("button");
        remover.type = "button";
        remover.className = "btn btn-danger";
        remover.textContent = "Remover";

        remover.addEventListener("click", () => removerItem(item.chave));

        const totalItem = document.createElement("p");
        totalItem.textContent = `Total: ${moeda(precoUnitario * item.quantidade)}`;

        controles.append(diminuir, quantidade, aumentar, remover);
        conteudo.append(nome, adicionais, preco, controles, totalItem);
        artigo.appendChild(conteudo);
        lista.appendChild(artigo);
    });

    const subtotal = calcularSubtotal(carrinho);

    subtotalElemento.textContent = moeda(subtotal);
    taxaElemento.textContent = moeda(0);
    descontoElemento.textContent = moeda(0);
    totalElemento.textContent = moeda(subtotal);
}

function alterarQuantidade(chave, diferenca) {
    const carrinho = obterCarrinho();
    const item = carrinho.find(produto => produto.chave === chave);

    if (!item) return;

    item.quantidade += diferenca;

    if (item.quantidade <= 0) {
        removerItem(chave);
        return;
    }

    salvarCarrinho(carrinho);
    renderizarCarrinho();
}

function removerItem(chave) {
    const carrinho = obterCarrinho().filter(item => item.chave !== chave);
    salvarCarrinho(carrinho);
    renderizarCarrinho();
}

botaoLimpar.addEventListener("click", () => {
    if (!confirm("Deseja realmente limpar o carrinho?")) return;

    salvarCarrinho([]);
    renderizarCarrinho();
});

renderizarCarrinho();



/* =====================================================
   CENTRAL DE NOTIFICAÇÕES FRAGA LANCHES
   ===================================================== */
(function () {
    "use strict";

    if (window.fragaNotificacoesIniciado) return;
    window.fragaNotificacoesIniciado = true;

    function iniciarNotificacoes() {
        const cabecalho = document.querySelector(".header-actions");

        if (!cabecalho) return;

        if (document.querySelector(".fraga-notificacao")) return;

        const container = document.createElement("div");
        container.className = "fraga-notificacao";

        const botao = document.createElement("button");
        botao.className = "fraga-sino";
        botao.type = "button";
        botao.setAttribute("aria-label", "Notificações");
        botao.setAttribute("title", "Notificações");
        botao.textContent = "🔔";

        const contador = document.createElement("span");
        contador.className = "fraga-contador";

        const painel = document.createElement("div");
        painel.className = "fraga-painel-notificacoes";

        const topo = document.createElement("div");
        topo.className = "fraga-notificacoes-topo";

        const titulo = document.createElement("strong");
        titulo.textContent = "Notificações";

        const marcarTodas = document.createElement("button");
        marcarTodas.className = "fraga-marcar-todas";
        marcarTodas.type = "button";
        marcarTodas.textContent = "Marcar todas como lidas";

        const lista = document.createElement("div");
        lista.className = "fraga-lista-notificacoes";

        topo.append(titulo, marcarTodas);
        painel.append(topo, lista);
        container.append(botao, contador, painel);

        cabecalho.prepend(container);

        let notificacoes = [];

        function atualizarContador(valor) {
            const quantidade = Number(valor) || 0;

            contador.textContent = quantidade > 99 ? "99+" : quantidade;
            contador.style.display = quantidade > 0 ? "flex" : "none";
        }

        function formatarData(data) {
            if (!data) return "";

            const dataValida = new Date(data);

            if (Number.isNaN(dataValida.getTime())) return "";

            return dataValida.toLocaleString("pt-BR");
        }

        function renderizar(dados) {
            lista.replaceChildren();

            if (!Array.isArray(dados) || dados.length === 0) {
                const vazio = document.createElement("div");
                vazio.className = "fraga-notificacao-vazia";
                vazio.textContent = "Nenhuma notificação encontrada.";
                lista.appendChild(vazio);
                return;
            }

            dados.forEach(function (notificacao) {
                const item = document.createElement("div");

                item.className = "fraga-notificacao-item";

                if (!Number(notificacao.lida)) {
                    item.classList.add("nao-lida");
                }

                const tituloItem = document.createElement("strong");
                tituloItem.textContent = notificacao.titulo || "Notificação";

                const mensagem = document.createElement("p");
                mensagem.textContent = notificacao.mensagem || "";

                const data = document.createElement("small");
                data.textContent = formatarData(notificacao.data_criacao);

                item.append(tituloItem, mensagem, data);

                if (!Number(notificacao.lida)) {
                    item.addEventListener("click", async function () {
                        try {
                            const resposta = await fetch(
                                "/api/notificacoes/" +
                                encodeURIComponent(notificacao.id) +
                                "/lida",
                                {
                                    method: "PATCH",
                                    credentials: "same-origin"
                                }
                            );

                            if (resposta.ok) {
                                await carregarNotificacoes();
                            }
                        } catch (erro) {
                            console.error(
                                "[Notificações] Erro ao marcar como lida:",
                                erro
                            );
                        }
                    });
                }

                lista.appendChild(item);
            });
        }

        async function carregarNotificacoes() {
            try {
                const resposta = await fetch("/api/notificacoes", {
                    method: "GET",
                    credentials: "same-origin",
                    headers: {
                        "Accept": "application/json"
                    }
                });

                if (resposta.status === 401 || resposta.status === 403) {
                    return;
                }

                if (!resposta.ok) {
                    throw new Error("Falha ao carregar notificações.");
                }

                const dados = await resposta.json();

                notificacoes = Array.isArray(dados.notificacoes)
                    ? dados.notificacoes
                    : [];

                atualizarContador(dados.naoLidas);
                renderizar(notificacoes);

            } catch (erro) {
                console.error("[Notificações]", erro);
            }
        }

        botao.addEventListener("click", function (evento) {
            evento.stopPropagation();

            painel.classList.toggle("aberto");

            if (painel.classList.contains("aberto")) {
                carregarNotificacoes();
            }
        });

        painel.addEventListener("click", function (evento) {
            evento.stopPropagation();
        });

        document.addEventListener("click", function () {
            painel.classList.remove("aberto");
        });

        marcarTodas.addEventListener("click", async function () {
            try {
                const resposta = await fetch("/api/notificacoes/lidas", {
                    method: "PATCH",
                    credentials: "same-origin"
                });

                if (resposta.ok) {
                    await carregarNotificacoes();
                }
            } catch (erro) {
                console.error(
                    "[Notificações] Erro ao marcar todas:",
                    erro
                );
            }
        });

        function conectarWebSocket() {
            const protocolo =
                location.protocol === "https:" ? "wss:" : "ws:";

            const ws = new WebSocket(
                protocolo + "//" + location.host + "/ws"
            );

            ws.addEventListener("message", function () {
                carregarNotificacoes();
            });

            ws.addEventListener("close", function () {
                setTimeout(conectarWebSocket, 5000);
            });

            ws.addEventListener("error", function () {
                ws.close();
            });
        }

        carregarNotificacoes();
        conectarWebSocket();
    }

    function aguardarCabecalho() {
        const encontrar = () => {
            const area = document.querySelector(".header-actions");

            if (!area) return false;

            iniciarNotificacoes();
            return true;
        };

        if (encontrar()) return;

        const observador = new MutationObserver(() => {
            if (encontrar()) {
                observador.disconnect();
            }
        });

        observador.observe(document.documentElement, {
            childList: true,
            subtree: true
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            aguardarCabecalho,
            { once: true }
        );
    } else {
        aguardarCabecalho();
    }
})();

