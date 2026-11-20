const categoriasFiltro = document.getElementById("categoriasFiltro");
const cardapioGrid = document.getElementById("cardapioGrid");
const emptyState = document.getElementById("emptyState");

let categoriaSelecionada = null;
let produtos = [];

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

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
      background-color: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(4px);
    }

    .fraga-modal-box {
      width: 100%;
      max-width: 480px;
      max-height: 85vh;
      overflow-y: auto;
      padding: 24px;
      border: 1px solid #323232;
      border-radius: 14px;
      background-color: #191919;
      color: #f5f5f5;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.65);
      font-family: "Montserrat", sans-serif;
    }

    .fraga-modal-box h2 {
      margin: 0 0 8px;
      color: #ffffff;
      font-family: "Anton", sans-serif;
      font-size: 26px;
      font-weight: 400;
      letter-spacing: 0.03em;
      text-transform: uppercase;
    }

    .fraga-modal-box p {
      margin: 0;
      color: #a5a5a5;
      font-size: 12px;
    }

    .fraga-modal-acoes {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 20px;
    }

    .fraga-btn-sec {
      padding: 10px 16px;
      border: 1px solid #3c3c3c;
      border-radius: 8px;
      background-color: #121212;
      color: #e5e5e5;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      text-decoration: none;
      cursor: pointer;
    }

    .fraga-btn-prim {
      padding: 10px 18px;
      border: 1px solid #f5c542;
      border-radius: 8px;
      background-color: #f5c542;
      color: #141414;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      text-decoration: none;
      cursor: pointer;
    }
  `;
  document.head.appendChild(style);
}

/* =====================================================
   CATEGORIAS E PRODUTOS
   ===================================================== */

async function carregarCategorias() {
  try {
    const resposta = await fetch("/api/cardapio/categorias");

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
    console.error(erro);
    categoriasFiltro.textContent = "Não foi possível carregar as categorias.";
  }
}

function atualizarCategoriaAtiva(botaoSelecionado) {
  categoriasFiltro.querySelectorAll("button").forEach((botao) => {
    botao.classList.remove("categoria-ativa", "active");
  });

  botaoSelecionado.classList.add("categoria-ativa", "active");
}

async function carregarProdutos() {
  try {
    cardapioGrid.innerHTML = "<p>Carregando produtos...</p>";
    emptyState.classList.add("hidden");

    let url = "/api/cardapio/produtos";

    if (categoriaSelecionada !== null) {
      url += `?categoria=${encodeURIComponent(categoriaSelecionada)}`;
    }

    const resposta = await fetch(url);

    if (!resposta.ok) {
      throw new Error("Erro ao carregar produtos.");
    }

    produtos = await resposta.json();

    renderizarProdutos();
  } catch (erro) {
    console.error(erro);
    cardapioGrid.textContent = "Não foi possível carregar o cardápio.";
  }
}

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
    botao.addEventListener("click", () => carregarAdicionais(produto));

    artigo.append(imagem, nome, descricao, preco, botao);
    cardapioGrid.appendChild(artigo);
  });
}

async function carregarAdicionais(produto) {
  try {
    const resposta = await fetch(
      `/api/cardapio/produtos/${produto.id}/adicionais`,
    );

    if (!resposta.ok) {
      throw new Error("Erro ao carregar adicionais.");
    }

    const adicionais = await resposta.json();
    abrirModalAdicionais(produto, Array.isArray(adicionais) ? adicionais : []);
  } catch (erro) {
    console.warn("Adicionais indisponíveis, adicionando direto:", erro);
    adicionarAoCarrinho(produto, []);
  }
}

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
      ? "Selecione os adicionais desejados."
      : "Deseja adicionar este item ao carrinho?";

  const lista = document.createElement("div");
  lista.style.display = "grid";
  lista.style.gap = "12px";
  lista.style.margin = "18px 0";

  adicionais.forEach((adicional) => {
    const label = document.createElement("label");
    label.style.display = "flex";
    label.style.alignItems = "center";
    label.style.gap = "10px";
    label.style.fontSize = "13px";
    label.style.cursor = "pointer";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = adicional.id;
    checkbox.dataset.nome = adicional.nome;
    checkbox.dataset.preco = adicional.preco;
    checkbox.style.accentColor = "#f5c542";

    const texto = document.createElement("span");
    texto.textContent = `${adicional.nome} (+${formatarMoeda(adicional.preco)})`;

    label.append(checkbox, texto);
    lista.appendChild(label);
  });

  const botoes = document.createElement("div");
  botoes.className = "fraga-modal-acoes";

  const cancelar = document.createElement("button");
  cancelar.type = "button";
  cancelar.className = "fraga-btn-sec";
  cancelar.textContent = "Cancelar";
  cancelar.addEventListener("click", () => overlay.remove());

  const adicionar = document.createElement("button");
  adicionar.type = "button";
  adicionar.className = "fraga-btn-prim";
  adicionar.textContent = "Adicionar";

  adicionar.addEventListener("click", () => {
    const selecionados = [...lista.querySelectorAll("input:checked")].map(
      (input) => ({
        id: Number(input.value),
        nome: input.dataset.nome,
        preco: Number(input.dataset.preco),
      }),
    );

    adicionarAoCarrinho(produto, selecionados);
    overlay.remove();
  });

  botoes.append(cancelar, adicionar);
  modal.append(titulo, descricao, lista, botoes);
  overlay.appendChild(modal);

  overlay.addEventListener("click", (evento) => {
    if (evento.target === overlay) overlay.remove();
  });

  document.body.appendChild(overlay);
}

async function adicionarAoCarrinho(produto, adicionaisSelecionados = []) {
  const produtoId = Number(produto.id);

  if (!Number.isInteger(produtoId) || produtoId <= 0) {
    alert("Produto inválido.");
    return;
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
      }),
    });

    if (resposta.status === 401) {
      window.location.href = "/cadastro/login.html";
      return;
    }

    const dados = await resposta.json().catch(() => ({}));

    if (!resposta.ok) {
      throw new Error(
        dados.mensagem || "Não foi possível adicionar o produto ao carrinho.",
      );
    }

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
  } catch (erro) {
    console.error("Erro ao adicionar ao carrinho:", erro);
    alert(erro.message);
  }
}

async function iniciarCardapio() {
  if (!categoriasFiltro || !cardapioGrid || !emptyState) return;

  await carregarCategorias();
  await carregarProdutos();
}

iniciarCardapio();
