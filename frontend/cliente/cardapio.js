"use strict";

// =====================================================
// ELEMENTOS E ESTADO
// =====================================================

const categoriasFiltro = document.getElementById("categoriasFiltro");
const cardapioGrid = document.getElementById("cardapioGrid");
const emptyState = document.getElementById("emptyState");

let categoriaSelecionada = null;
let produtos = [];

// =====================================================
// UTILITÁRIOS
// =====================================================

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function obterPreco(valor) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
}

// =====================================================
// ESTILOS DO MODAL
// =====================================================

function injetarEstilosModalCardapio() {
  if (document.getElementById("estiloModalCardapio")) return;

  const style = document.createElement("style");
  style.id = "estiloModalCardapio";

  style.textContent = `
    .fraga-modal-overlay {
      position: fixed;
      inset: 0;
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      background: rgba(0, 0, 0, 0.78);
      backdrop-filter: blur(5px);
      animation: fragaFadeIn .2s ease;
    }

    .fraga-modal-box {
      width: 100%;
      max-width: 480px;
      max-height: 85vh;
      overflow-y: auto;
      padding: 24px;
      border: 1px solid #353535;
      border-radius: 16px;
      background: linear-gradient(145deg, #202020, #141414);
      color: #f5f5f5;
      box-shadow: 0 20px 50px rgba(0, 0, 0, .65);
      font-family: "Montserrat", sans-serif;
      animation: fragaModalIn .2s ease;
    }

    .fraga-modal-box h2 {
      margin: 0 0 8px;
      color: #fff;
      font-family: "Anton", sans-serif;
      font-size: 27px;
      font-weight: 400;
      letter-spacing: .03em;
      text-transform: uppercase;
    }

    .fraga-modal-box p {
      margin: 0;
      color: #aaa;
      font-size: 12px;
      line-height: 1.6;
    }

    .fraga-modal-lista {
      display: grid;
      gap: 10px;
      margin: 20px 0;
    }

    .fraga-modal-adicional {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 12px;
      border: 1px solid #333;
      border-radius: 9px;
      background: #181818;
      cursor: pointer;
      transition: border-color .2s, background .2s;
    }

    .fraga-modal-adicional:hover {
      border-color: #f5c542;
      background: #222;
    }

    .fraga-modal-adicional span {
      color: #eee;
      font-size: 12px;
      font-weight: 600;
    }

    .fraga-modal-adicional small {
      display: block;
      margin-top: 4px;
      color: #f5c542;
      font-size: 11px;
    }

    .fraga-modal-adicional input {
      width: 17px;
      height: 17px;
      flex-shrink: 0;
      accent-color: #f5c542;
      cursor: pointer;
    }

    .fraga-modal-total {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      padding: 14px 0;
      border-top: 1px solid #353535;
      color: #aaa;
      font-size: 12px;
    }

    .fraga-modal-total strong {
      color: #f5c542;
      font-size: 17px;
    }

    .fraga-modal-acoes {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 18px;
    }

    .fraga-btn-sec,
    .fraga-btn-prim {
      padding: 11px 17px;
      border-radius: 8px;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      cursor: pointer;
      transition: .2s;
    }

    .fraga-btn-sec {
      border: 1px solid #414141;
      background: #121212;
      color: #eee;
    }

    .fraga-btn-sec:hover {
      border-color: #777;
      background: #292929;
    }

    .fraga-btn-prim {
      border: 1px solid #f5c542;
      background: #f5c542;
      color: #141414;
    }

    .fraga-btn-prim:hover {
      background: #ffda69;
      transform: translateY(-1px);
    }

    .fraga-btn-prim:disabled {
      opacity: .55;
      cursor: not-allowed;
      transform: none;
    }

    @keyframes fragaFadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes fragaModalIn {
      from {
        opacity: 0;
        transform: translateY(12px) scale(.98);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }
  `;

  document.head.appendChild(style);
}

// =====================================================
// CATEGORIAS
// =====================================================

async function carregarCategorias() {
  try {
    const resposta = await fetch("/api/cardapio/categorias", {
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
      },
    });

    if (!resposta.ok) {
      throw new Error("Erro ao carregar categorias.");
    }

    const categorias = await resposta.json();

    categoriasFiltro.innerHTML = "";

    const botaoTodos = document.createElement("button");
    botaoTodos.type = "button";
    botaoTodos.textContent = "Todos";
    botaoTodos.classList.add("categoria-ativa", "active");

    botaoTodos.addEventListener("click", () => {
      categoriaSelecionada = null;
      atualizarCategoriaAtiva(botaoTodos);
      carregarProdutos();
    });

    categoriasFiltro.appendChild(botaoTodos);

    categorias.forEach((categoria) => {
      const botao = document.createElement("button");

      botao.type = "button";
      botao.textContent = categoria.nome;

      botao.addEventListener("click", () => {
        categoriaSelecionada = categoria.id;
        atualizarCategoriaAtiva(botao);
        carregarProdutos();
      });

      categoriasFiltro.appendChild(botao);
    });
  } catch (erro) {
    console.error("Erro ao carregar categorias:", erro);

    categoriasFiltro.textContent = "Não foi possível carregar as categorias.";
  }
}

function atualizarCategoriaAtiva(botaoSelecionado) {
  categoriasFiltro.querySelectorAll("button").forEach((botao) => {
    botao.classList.remove("categoria-ativa", "active");
  });

  botaoSelecionado.classList.add("categoria-ativa", "active");
}

// =====================================================
// PRODUTOS
// =====================================================

async function carregarProdutos() {
  try {
    cardapioGrid.innerHTML = "<p>Carregando produtos...</p>";
    emptyState.classList.add("hidden");

    let url = "/api/cardapio/produtos";

    if (categoriaSelecionada !== null) {
      url += `?categoria=${encodeURIComponent(categoriaSelecionada)}`;
    }

    const resposta = await fetch(url, {
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
      },
    });

    if (!resposta.ok) {
      throw new Error("Erro ao carregar produtos.");
    }

    produtos = await resposta.json();

    if (!Array.isArray(produtos)) {
      throw new Error("Resposta inválida do cardápio.");
    }

    renderizarProdutos();
  } catch (erro) {
    console.error("Erro ao carregar produtos:", erro);

    cardapioGrid.textContent = "Não foi possível carregar o cardápio.";
  }
}

// =====================================================
// RENDERIZAR PRODUTOS
// =====================================================

function renderizarProdutos() {
  cardapioGrid.innerHTML = "";

  if (produtos.length === 0) {
    emptyState.classList.remove("hidden");
    return;
  }

  emptyState.classList.add("hidden");

  produtos.forEach((produto) => {
    const artigo = document.createElement("article");
    artigo.classList.add("produto-card");

    const imagem = document.createElement("img");

    imagem.src = produto.imagem || "/img/produto-sem-imagem.png";
    imagem.alt = produto.nome;
    imagem.loading = "lazy";

    imagem.addEventListener(
      "error",
      () => {
        imagem.removeAttribute("src");
        imagem.alt = "Imagem indisponível";
      },
      { once: true },
    );

    const nome = document.createElement("h2");
    nome.textContent = produto.nome;

    const descricao = document.createElement("p");
    descricao.textContent = produto.descricao || "";

    const preco = document.createElement("p");
    preco.textContent = formatarMoeda(produto.preco);

    const botao = document.createElement("button");

    botao.type = "button";
    botao.textContent = "Adicionar ao carrinho";

    botao.addEventListener("click", () => {
      carregarAdicionais(produto);
    });

    artigo.append(imagem, nome, descricao, preco, botao);

    cardapioGrid.appendChild(artigo);
  });
}

// =====================================================
// CARREGAR ADICIONAIS
// =====================================================

async function carregarAdicionais(produto) {
  try {
    const resposta = await fetch(
      `/api/cardapio/produtos/${produto.id}/adicionais`,
      {
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
        },
      },
    );

    if (!resposta.ok) {
      throw new Error("Não foi possível carregar os adicionais.");
    }

    const adicionais = await resposta.json();

    abrirModalAdicionais(produto, Array.isArray(adicionais) ? adicionais : []);
  } catch (erro) {
    console.error("Erro ao carregar adicionais:", erro);

    const confirmar = window.confirm(
      "Não foi possível carregar os adicionais. Deseja adicionar o produto sem adicionais?",
    );

    if (confirmar) {
      await adicionarAoCarrinho(produto, []);
    }
  }
}

// =====================================================
// MODAL DE ADICIONAIS
// =====================================================

function abrirModalAdicionais(produto, adicionais) {
  injetarEstilosModalCardapio();

  const overlay = document.createElement("div");
  overlay.className = "fraga-modal-overlay";

  const modal = document.createElement("div");
  modal.className = "fraga-modal-box";

  const titulo = document.createElement("h2");
  titulo.textContent = produto.nome;

  const descricao = document.createElement("p");

  descricao.textContent =
    adicionais.length > 0
      ? "Escolha os adicionais para personalizar seu pedido."
      : "Este produto não possui adicionais disponíveis.";

  const lista = document.createElement("div");
  lista.className = "fraga-modal-lista";

  const total = document.createElement("div");
  total.className = "fraga-modal-total";

  const totalTexto = document.createElement("span");
  totalTexto.textContent = "Total do produto";

  const totalValor = document.createElement("strong");

  const botoes = document.createElement("div");
  botoes.className = "fraga-modal-acoes";

  const cancelar = document.createElement("button");
  cancelar.type = "button";
  cancelar.className = "fraga-btn-sec";
  cancelar.textContent = "Cancelar";

  const adicionar = document.createElement("button");
  adicionar.type = "button";
  adicionar.className = "fraga-btn-prim";
  adicionar.textContent = "Adicionar ao carrinho";

  const precoBase = obterPreco(produto.preco);

  function atualizarTotal() {
    const selecionados = [...lista.querySelectorAll("input:checked")];

    const somaAdicionais = selecionados.reduce(
      (soma, input) => soma + obterPreco(input.dataset.preco),
      0,
    );

    totalValor.textContent = formatarMoeda(precoBase + somaAdicionais);
  }

  adicionais.forEach((adicional) => {
    const label = document.createElement("label");
    label.className = "fraga-modal-adicional";

    const informacoes = document.createElement("div");

    const nome = document.createElement("span");
    nome.textContent = adicional.nome;

    const preco = document.createElement("small");
    preco.textContent = `+ ${formatarMoeda(adicional.preco)}`;

    informacoes.append(nome, preco);

    const checkbox = document.createElement("input");

    checkbox.type = "checkbox";
    checkbox.value = adicional.id;
    checkbox.dataset.preco = obterPreco(adicional.preco);

    checkbox.addEventListener("change", atualizarTotal);

    label.append(informacoes, checkbox);
    lista.appendChild(label);
  });

  atualizarTotal();

  cancelar.addEventListener("click", () => {
    overlay.remove();
  });

  adicionar.addEventListener("click", async () => {
    const selecionados = [...lista.querySelectorAll("input:checked")].map(
      (input) => ({
        id: Number(input.value),
      }),
    );

    adicionar.disabled = true;
    adicionar.textContent = "Adicionando...";

    const sucesso = await adicionarAoCarrinho(produto, selecionados);

    if (sucesso) {
      overlay.remove();
    } else {
      adicionar.disabled = false;
      adicionar.textContent = "Adicionar ao carrinho";
    }
  });

  total.append(totalTexto, totalValor);
  botoes.append(cancelar, adicionar);

  modal.append(titulo, descricao, lista, total, botoes);

  overlay.appendChild(modal);

  overlay.addEventListener("click", (evento) => {
    if (evento.target === overlay) {
      overlay.remove();
    }
  });

  function fecharComEsc(evento) {
    if (evento.key === "Escape") {
      overlay.remove();
      document.removeEventListener("keydown", fecharComEsc);
    }
  }

  document.addEventListener("keydown", fecharComEsc);

  overlay.addEventListener("remove", () => {
    document.removeEventListener("keydown", fecharComEsc);
  });

  document.body.appendChild(overlay);
}

// =====================================================
// ADICIONAR AO CARRINHO
// =====================================================

async function adicionarAoCarrinho(produto, adicionaisSelecionados = []) {
  const produtoId = Number(produto.id);

  if (!Number.isInteger(produtoId) || produtoId <= 0) {
    alert("Produto inválido.");
    return false;
  }

  const adicionaisIds = adicionaisSelecionados.map((adicional) =>
    Number(adicional.id),
  );

  console.log("PRODUTO ENVIADO:", produtoId);
  console.log("ADICIONAIS ENVIADOS:", adicionaisIds);

  if (adicionaisIds.some((id) => !Number.isInteger(id) || id <= 0)) {
    alert("Um ou mais adicionais são inválidos.");
    return false;
  }

  try {
    const resposta = await fetch("/api/cliente/carrinho/itens", {
      method: "POST",
      credentials: "same-origin",

      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },

      body: JSON.stringify({
        produto_id: produtoId,
        quantidade: 1,
        adicionais: adicionaisIds,
      }),
    });

    if (resposta.status === 401) {
      window.location.href = "/cadastro/login.html";
      return false;
    }

    const dados = await resposta.json().catch(() => ({}));

    if (!resposta.ok) {
      throw new Error(
        dados.mensagem || "Não foi possível adicionar o produto ao carrinho.",
      );
    }

    // Atualiza o carrinho flutuante com a resposta do servidor.
    if (
      typeof window.fragaAtualizarEstadoCarrinho === "function" &&
      dados.carrinho
    ) {
      window.fragaAtualizarEstadoCarrinho(dados.carrinho);
    } else if (typeof window.fragaRecarregarCarrinho === "function") {
      await window.fragaRecarregarCarrinho();
    } else {
      window.dispatchEvent(new CustomEvent("fraga:carrinho-atualizado"));
    }

    return true;
  } catch (erro) {
    console.error("Erro ao adicionar ao carrinho:", erro);

    alert(erro.message);

    return false;
  }
}

// =====================================================
// INICIALIZAÇÃO
// =====================================================

async function iniciarCardapio() {
  if (!categoriasFiltro || !cardapioGrid || !emptyState) {
    console.error("Elementos do cardápio não encontrados.");
    return;
  }

  await carregarCategorias();
  await carregarProdutos();
}

iniciarCardapio();



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

