const categoriasFiltro = document.getElementById("categoriasFiltro");
const cardapioGrid = document.getElementById("cardapioGrid");
const emptyState = document.getElementById("emptyState");

let categoriaSelecionada = null;
let produtos = [];

const CHAVE_CARRINHO = "fraga_carrinho";

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

function formatarMoeda(valor) {
  return Number(valor).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

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
    botaoTodos.classList.add("categoria-ativa");

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
    botao.classList.remove("categoria-ativa");
  });

  botaoSelecionado.classList.add("categoria-ativa");
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

    abrirModalAdicionais(produto, adicionais);
  } catch (erro) {
    console.error(erro);
    alert("Não foi possível carregar os adicionais.");
  }
}

function abrirModalAdicionais(produto, adicionais) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";

  const modal = document.createElement("div");
  modal.className = "modal";
  modal.style.maxWidth = "480px";

  const titulo = document.createElement("h2");
  titulo.textContent = produto.nome;

  const descricao = document.createElement("p");
  descricao.textContent = "Selecione os adicionais desejados.";

  const lista = document.createElement("div");
  lista.style.display = "grid";
  lista.style.gap = "12px";
  lista.style.margin = "20px 0";

  adicionais.forEach((adicional) => {
    const label = document.createElement("label");
    label.style.display = "flex";
    label.style.alignItems = "center";
    label.style.gap = "10px";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = adicional.id;
    checkbox.dataset.nome = adicional.nome;
    checkbox.dataset.preco = adicional.preco;

    const texto = document.createElement("span");
    texto.textContent = `${adicional.nome} (+${formatarMoeda(adicional.preco)})`;

    label.append(checkbox, texto);
    lista.appendChild(label);
  });

  const botoes = document.createElement("div");
  botoes.style.display = "flex";
  botoes.style.gap = "10px";
  botoes.style.justifyContent = "flex-end";

  const cancelar = document.createElement("button");
  cancelar.type = "button";
  cancelar.className = "btn btn-secondary";
  cancelar.textContent = "Cancelar";
  cancelar.addEventListener("click", () => overlay.remove());

  const adicionar = document.createElement("button");
  adicionar.type = "button";
  adicionar.className = "btn btn-primary";
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

function adicionarAoCarrinho(produto, adicionaisSelecionados) {
  const carrinho = obterCarrinho();

  const chave = `${produto.id}-${adicionaisSelecionados
    .map((adicional) => adicional.id)
    .sort((a, b) => a - b)
    .join(",")}`;

  const existente = carrinho.find((item) => item.chave === chave);

  if (existente) {
    existente.quantidade += 1;
  } else {
    carrinho.push({
      chave,
      produtoId: produto.id,
      nome: produto.nome,
      preco: Number(produto.preco),
      imagem: produto.imagem || "",
      quantidade: 1,
      adicionais: adicionaisSelecionados,
    });
  }

  salvarCarrinho(carrinho);

  alert(`${produto.nome} adicionado ao carrinho!`);
}

async function iniciarCardapio() {
  if (!categoriasFiltro || !cardapioGrid || !emptyState) return;

  await carregarCategorias();
  await carregarProdutos();
}

iniciarCardapio();
