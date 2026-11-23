"use strict";

document.addEventListener("DOMContentLoaded", () => {
  // ======================================================
  // CONFIGURAÇÕES
  // ======================================================

  const API_PRODUTOS = "/api/admin/produtos";
  const API_CATEGORIAS = "/api/admin/categorias";
  const API_AUTH = "/api/auth";

  // ======================================================
  // ELEMENTOS GERAIS
  // ======================================================

  const pageTitle = document.getElementById("pageTitle");
  const pageSubtitle = document.getElementById("pageSubtitle");
  const btnAcaoPrincipal = document.getElementById("btnAcaoPrincipal");

  const contadorProdutos = document.getElementById("contadorProdutos");
  const contadorCategorias = document.getElementById("contadorCategorias");

  const emptyStateProdutos = document.getElementById("emptyStateProdutos");
  const emptyStateCategorias = document.getElementById("emptyStateCategorias");

  // ======================================================
  // ELEMENTOS DE PRODUTOS
  // ======================================================

  const formProduto = document.getElementById("produtoForm");
  const modalProduto = document.getElementById("produtoModal");
  const modalProdutoTitulo = document.getElementById("produtoModalTitulo");

  const produtoId = document.getElementById("produtoId");
  const produtoNome = document.getElementById("produtoNome");
  const produtoCategoria = document.getElementById("produtoCategoria");
  const produtoDescricao = document.getElementById("produtoDescricao");
  const produtoPreco = document.getElementById("produtoPreco");
  const produtoImagem = document.getElementById("produtoImagem");
  const produtoDisponivel = document.getElementById("produtoAtivo");

  const tbodyProdutos = document.getElementById("tbodyProdutos");
  const buscaProduto = document.getElementById("buscaProduto");
  const filtroCategoria = document.getElementById("filtroCategoria");
  const filtroStatusProduto = document.getElementById("filtroStatusProduto");

  const btnPrimeiroProduto = document.getElementById("btnPrimeiroProduto");
  const btnSalvarProduto = document.getElementById("btnSalvarProduto");
  const btnFecharProduto = document.getElementById("produtoModalClose");
  const btnCancelarProduto = document.getElementById("btnCancelarProduto");

  const modalDeleteProduto = document.getElementById("deleteProdutoModal");
  const deleteProdutoNome = document.getElementById("deleteProdutoNome");

  const btnCancelarDeleteProduto = document.getElementById(
    "btnCancelarDeleteProduto",
  );

  const btnConfirmarDeleteProduto = document.getElementById(
    "btnConfirmarDeleteProduto",
  );

  // ======================================================
  // ELEMENTOS DE CATEGORIAS
  // ======================================================

  const formCategoria = document.getElementById("categoriaForm");
  const modalCategoria = document.getElementById("categoriaModal");
  const modalCategoriaTitulo = document.getElementById("categoriaModalTitulo");

  const categoriaId = document.getElementById("categoriaId");
  const categoriaNome = document.getElementById("categoriaNome");
  const categoriaDescricao = document.getElementById("categoriaDescricao");
  const categoriaAtivo = document.getElementById("categoriaAtivo");

  const tbodyCategorias = document.getElementById("tbodyCategorias");
  const buscaCategoria = document.getElementById("buscaCategoria");
  const filtroStatusCategoria = document.getElementById(
    "filtroStatusCategoria",
  );

  const btnNovaCategoria = document.getElementById("btnNovaCategoria");
  const btnPrimeiraCategoria = document.getElementById("btnPrimeiraCategoria");
  const btnSalvarCategoria = document.getElementById("btnSalvarCategoria");
  const btnFecharCategoria = document.getElementById("categoriaModalClose");
  const btnCancelarCategoria = document.getElementById("btnCancelarCategoria");

  const modalDeleteCategoria = document.getElementById("deleteCategoriaModal");
  const deleteCategoriaNome = document.getElementById("deleteCategoriaNome");

  const btnCancelarDeleteCategoria = document.getElementById(
    "btnCancelarDeleteCategoria",
  );

  const btnConfirmarDeleteCategoria = document.getElementById(
    "btnConfirmarDeleteCategoria",
  );

  // ======================================================
  // ELEMENTOS DO MENU
  // ======================================================

  const adminNav = document.getElementById("adminNav");
  const adminNavToggle = document.getElementById("adminNavToggle");

  const userButton = document.getElementById("userButton");
  const userDropdown = document.getElementById("userDropdown");
  const userMenu = document.getElementById("userMenu");
  const logoutBtn = document.getElementById("logoutBtn");

  const userName = document.getElementById("userName");
  const userAvatar = document.getElementById("userAvatar");
  const dropdownUserName = document.getElementById("dropdownUserName");
  const dropdownUserRole = document.getElementById("dropdownUserRole");

  // ======================================================
  // ESTADO
  // ======================================================

  let produtos = [];
  let categorias = [];

  let produtoParaExcluir = null;
  let categoriaParaExcluir = null;

  // ======================================================
  // VERIFICAÇÃO DOS ELEMENTOS ESSENCIAIS
  // ======================================================

  const elementosObrigatorios = [
    tbodyProdutos,
    tbodyCategorias,
    formProduto,
    formCategoria,
    modalProduto,
    modalCategoria,
    modalDeleteProduto,
    modalDeleteCategoria,
  ];

  const nomesElementos = [
    "tbodyProdutos",
    "tbodyCategorias",
    "produtoForm",
    "categoriaForm",
    "produtoModal",
    "categoriaModal",
    "deleteProdutoModal",
    "deleteCategoriaModal",
  ];

  const elementosAusentes = elementosObrigatorios
    .map((elemento, indice) => ({
      elemento,
      nome: nomesElementos[indice],
    }))
    .filter((item) => !item.elemento)
    .map((item) => item.nome);

  if (elementosAusentes.length > 0) {
    console.error(
      "[CARDÁPIO] Elementos HTML obrigatórios ausentes:",
      elementosAusentes.join(", "),
    );
    return;
  }

  // ======================================================
  // UTILITÁRIOS
  // ======================================================

  function normalizarLista(dados, propriedade) {
    if (Array.isArray(dados)) {
      return dados;
    }

    if (dados && Array.isArray(dados[propriedade])) {
      return dados[propriedade];
    }

    if (dados && Array.isArray(dados.data)) {
      return dados.data;
    }

    return [];
  }

  function categoriaEstaAtiva(valor) {
    return valor === true || valor === 1 || valor === "1" || valor === "true";
  }

  function produtoEstaDisponivel(valor) {
    return valor === true || valor === 1 || valor === "1" || valor === "true";
  }

  function criarElemento(tag, texto, classe = "") {
    const elemento = document.createElement(tag);

    if (texto !== undefined && texto !== null) {
      elemento.textContent = String(texto);
    }

    if (classe) {
      elemento.className = classe;
    }

    return elemento;
  }

  function criarCelula(texto, classe = "") {
    return criarElemento("td", texto, classe);
  }

  function criarBotao(texto, classe, callback) {
    const botao = document.createElement("button");

    botao.type = "button";
    botao.className = classe;
    botao.textContent = texto;

    botao.addEventListener("click", callback);

    return botao;
  }

  function mostrarMensagemTabela(tabela, colunas, mensagem) {
    tabela.replaceChildren();

    const linha = document.createElement("tr");
    const celula = document.createElement("td");

    celula.colSpan = colunas;
    celula.className = "text-center py-4";
    celula.textContent = mensagem;

    linha.appendChild(celula);
    tabela.appendChild(linha);
  }

  function formatarPreco(valor) {
    const preco = Number(valor);

    if (!Number.isFinite(preco)) {
      return "R$ 0,00";
    }

    return preco.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function atualizarContadores() {
    if (contadorProdutos) {
      contadorProdutos.textContent = produtos.length;
    }

    if (contadorCategorias) {
      contadorCategorias.textContent = categorias.length;
    }
  }

  // ======================================================
  // CONTROLE DOS MODAIS
  // ======================================================

  function abrirModal(modal) {
    if (!modal) return;

    modal.classList.remove("hidden");
    modal.classList.add("show");

    document.body.style.overflow = "hidden";
  }

  function fecharModal(modal) {
    if (!modal) return;

    modal.classList.remove("show");
    modal.classList.add("hidden");

    const algumModalAberto = [
      modalProduto,
      modalDeleteProduto,
      modalCategoria,
      modalDeleteCategoria,
    ].some((item) => item.classList.contains("show"));

    if (!algumModalAberto) {
      document.body.style.overflow = "";
    }
  }

  // ======================================================
  // REQUISIÇÕES
  // ======================================================

  async function requisicao(url, opcoes = {}) {
    const resposta = await fetch(url, {
      ...opcoes,
      credentials: "same-origin",
      headers: {
        ...(opcoes.headers || {}),
        "Content-Type": "application/json",
      },
    });

    const dados = await resposta.json().catch(() => ({}));

    if (resposta.status === 401 || resposta.status === 403) {
      alert("Sua sessão expirou ou você não tem permissão de administrador.");

      window.location.href = "/admin/admin-login.html";

      throw new Error("Acesso não autorizado.");
    }

    if (!resposta.ok) {
      throw new Error(
        dados.mensagem || dados.erro || "Não foi possível concluir a operação.",
      );
    }

    return dados;
  }

  // ======================================================
  // NOVO PRODUTO
  // ======================================================

  function novoProduto() {
    formProduto.reset();

    produtoId.value = "";
    produtoDisponivel.checked = true;

    modalProdutoTitulo.textContent = "Novo Produto";
    btnSalvarProduto.textContent = "Salvar Produto";

    abrirModal(modalProduto);
  }

  if (btnAcaoPrincipal) {
    btnAcaoPrincipal.textContent = "Novo Produto";
    btnAcaoPrincipal.addEventListener("click", novoProduto);
  }

  // ======================================================
  // CARREGAR CATEGORIAS
  // ======================================================

  async function carregarCategorias() {
    try {
      const resposta = await requisicao(API_CATEGORIAS);

      categorias = normalizarLista(resposta, "categorias");

      atualizarSelectsCategorias();
      renderizarCategorias();
      atualizarContadores();

      return categorias;
    } catch (erro) {
      console.error("[CARDÁPIO] Erro ao carregar categorias:", erro);

      mostrarMensagemTabela(
        tbodyCategorias,
        4,
        erro.message || "Erro ao carregar categorias.",
      );

      throw erro;
    }
  }

  // ======================================================
  // ATUALIZAR SELECTS DE CATEGORIAS
  // ======================================================

  function atualizarSelectsCategorias() {
    const categoriaSelecionada = produtoCategoria.value;
    const filtroSelecionado = filtroCategoria.value;

    produtoCategoria.replaceChildren();

    const opcaoInicial = document.createElement("option");
    opcaoInicial.value = "";
    opcaoInicial.textContent = "Selecione uma categoria";

    produtoCategoria.appendChild(opcaoInicial);

    filtroCategoria.replaceChildren();

    const opcaoTodas = document.createElement("option");
    opcaoTodas.value = "";
    opcaoTodas.textContent = "Todas as categorias";

    filtroCategoria.appendChild(opcaoTodas);

    categorias.forEach((categoria) => {
      const opcao = document.createElement("option");

      opcao.value = categoria.id;
      opcao.textContent = categoria.nome;

      produtoCategoria.appendChild(opcao);

      const opcaoFiltro = document.createElement("option");

      opcaoFiltro.value = categoria.id;
      opcaoFiltro.textContent = categoria.nome;

      filtroCategoria.appendChild(opcaoFiltro);
    });

    if (
      categoriaSelecionada &&
      [...produtoCategoria.options].some(
        (opcao) => opcao.value === String(categoriaSelecionada),
      )
    ) {
      produtoCategoria.value = categoriaSelecionada;
    }

    if (
      filtroSelecionado &&
      [...filtroCategoria.options].some(
        (opcao) => opcao.value === String(filtroSelecionado),
      )
    ) {
      filtroCategoria.value = filtroSelecionado;
    }
  }

  // ======================================================
  // CARREGAR PRODUTOS
  // ======================================================

  async function carregarProdutos() {
    try {
      mostrarMensagemTabela(tbodyProdutos, 6, "Carregando produtos...");

      const resposta = await requisicao(API_PRODUTOS);

      produtos = normalizarLista(resposta, "produtos");

      renderizarProdutos();
      atualizarContadores();

      return produtos;
    } catch (erro) {
      console.error("[CARDÁPIO] Erro ao carregar produtos:", erro);

      mostrarMensagemTabela(
        tbodyProdutos,
        6,
        erro.message || "Erro ao carregar produtos.",
      );

      throw erro;
    }
  }

  // ======================================================
  // RENDERIZAR PRODUTOS
  // ======================================================

  function renderizarProdutos() {
    const termo = buscaProduto.value.trim().toLowerCase();
    const categoriaSelecionada = filtroCategoria.value;
    const disponibilidade = filtroStatusProduto.value;

    const filtrados = produtos.filter((produto) => {
      const nome = String(produto.nome || "").toLowerCase();

      const correspondeNome = nome.includes(termo);

      const correspondeCategoria =
        !categoriaSelecionada ||
        String(produto.categoria_id) === categoriaSelecionada;

      const disponivel = produtoEstaDisponivel(produto.disponivel);

      const correspondeDisponibilidade =
        !disponibilidade ||
        (disponibilidade === "disponivel" && disponivel) ||
        (disponibilidade === "indisponivel" && !disponivel);

      return (
        correspondeNome && correspondeCategoria && correspondeDisponibilidade
      );
    });

    tbodyProdutos.replaceChildren();

    if (emptyStateProdutos) {
      emptyStateProdutos.classList.toggle("hidden", filtrados.length > 0);
    }

    if (filtrados.length === 0) {
      mostrarMensagemTabela(
        tbodyProdutos,
        6,
        produtos.length === 0
          ? "Nenhum produto cadastrado."
          : "Nenhum produto encontrado com esses filtros.",
      );

      return;
    }

    filtrados.forEach((produto) => {
      const linha = document.createElement("tr");

      const celulaImagem = document.createElement("td");

      if (produto.imagem) {
        const imagem = document.createElement("img");

        imagem.src = produto.imagem;
        imagem.alt = produto.nome || "Imagem do produto";
        imagem.className = "product-thumb";
        imagem.loading = "lazy";

        imagem.addEventListener("error", () => {
          imagem.style.display = "none";
        });

        celulaImagem.appendChild(imagem);
      } else {
        celulaImagem.textContent = "Sem imagem";
      }

      const celulaNome = criarCelula(produto.nome || "Sem nome");

      const celulaCategoria = criarCelula(
        produto.categoria_nome || "Sem categoria",
      );

      const celulaPreco = criarCelula(formatarPreco(produto.preco));

      const disponivel = produtoEstaDisponivel(produto.disponivel);

      const celulaStatus = document.createElement("td");

      const status = criarElemento(
        "span",
        disponivel ? "Disponível" : "Indisponível",
        `status-pill ${disponivel ? "status-active" : "status-inactive"}`,
      );

      celulaStatus.appendChild(status);

      const celulaAcoes = document.createElement("td");
      const grupoAcoes = criarElemento("div", undefined, "action-group");

      const btnEditar = criarBotao(
        "Editar",
        "btn btn-secondary btn-small",
        () => editarProduto(produto),
      );

      const btnExcluir = criarBotao("Excluir", "btn btn-danger btn-small", () =>
        prepararExclusaoProduto(produto),
      );

      grupoAcoes.append(btnEditar, btnExcluir);
      celulaAcoes.appendChild(grupoAcoes);

      linha.append(
        celulaImagem,
        celulaNome,
        celulaCategoria,
        celulaPreco,
        celulaStatus,
        celulaAcoes,
      );

      tbodyProdutos.appendChild(linha);
    });
  }

  // ======================================================
  // RENDERIZAR CATEGORIAS
  // ======================================================

  function renderizarCategorias() {
    const termo = buscaCategoria.value.trim().toLowerCase();
    const statusSelecionado = filtroStatusCategoria.value;

    const filtradas = categorias.filter((categoria) => {
      const nome = String(categoria.nome || "").toLowerCase();
      const ativa = categoriaEstaAtiva(categoria.ativo);

      const correspondeNome = nome.includes(termo);

      const correspondeStatus =
        !statusSelecionado ||
        (statusSelecionado === "ativo" && ativa) ||
        (statusSelecionado === "inativo" && !ativa);

      return correspondeNome && correspondeStatus;
    });

    tbodyCategorias.replaceChildren();

    if (emptyStateCategorias) {
      emptyStateCategorias.classList.toggle("hidden", filtradas.length > 0);
    }

    if (filtradas.length === 0) {
      mostrarMensagemTabela(
        tbodyCategorias,
        4,
        categorias.length === 0
          ? "Nenhuma categoria cadastrada."
          : "Nenhuma categoria encontrada com esses filtros.",
      );

      return;
    }

    filtradas.forEach((categoria) => {
      const linha = document.createElement("tr");

      const celulaNome = criarCelula(categoria.nome || "Sem nome");

      const celulaDescricao = criarCelula(
        categoria.descricao || "Sem descrição",
      );

      const ativa = categoriaEstaAtiva(categoria.ativo);

      const celulaStatus = document.createElement("td");

      const status = criarElemento(
        "span",
        ativa ? "Ativa" : "Inativa",
        `status-pill ${ativa ? "status-active" : "status-inactive"}`,
      );

      celulaStatus.appendChild(status);

      const celulaAcoes = document.createElement("td");
      const grupoAcoes = criarElemento("div", undefined, "action-group");

      const btnEditar = criarBotao(
        "Editar",
        "btn btn-secondary btn-small",
        () => editarCategoria(categoria),
      );

      const btnExcluir = criarBotao("Excluir", "btn btn-danger btn-small", () =>
        prepararExclusaoCategoria(categoria),
      );

      grupoAcoes.append(btnEditar, btnExcluir);
      celulaAcoes.appendChild(grupoAcoes);

      linha.append(celulaNome, celulaDescricao, celulaStatus, celulaAcoes);

      tbodyCategorias.appendChild(linha);
    });
  }

  // ======================================================
  // MODAL DE PRODUTO
  // ======================================================

  function abrirModalProduto() {
    abrirModal(modalProduto);
  }

  function fecharModalProduto() {
    fecharModal(modalProduto);

    formProduto.reset();

    produtoId.value = "";
    produtoDisponivel.checked = true;
  }

  function editarProduto(produto) {
    formProduto.reset();

    produtoId.value = produto.id;
    produtoNome.value = produto.nome || "";
    produtoCategoria.value = String(produto.categoria_id || "");
    produtoDescricao.value = produto.descricao || "";
    produtoPreco.value = produto.preco ?? "";
    produtoImagem.value = produto.imagem || "";

    produtoDisponivel.checked = produtoEstaDisponivel(produto.disponivel);

    modalProdutoTitulo.textContent = "Editar Produto";
    btnSalvarProduto.textContent = "Salvar Alterações";

    abrirModalProduto();
  }

  if (btnPrimeiroProduto) {
    btnPrimeiroProduto.addEventListener("click", novoProduto);
  }

  if (btnFecharProduto) {
    btnFecharProduto.addEventListener("click", fecharModalProduto);
  }

  if (btnCancelarProduto) {
    btnCancelarProduto.addEventListener("click", fecharModalProduto);
  }

  modalProduto.addEventListener("click", (event) => {
    if (event.target === modalProduto) {
      fecharModalProduto();
    }
  });

  // ======================================================
  // SALVAR PRODUTO
  // ======================================================

  formProduto.addEventListener("submit", async (event) => {
    event.preventDefault();

    const nome = produtoNome.value.trim();
    const categoria_id = Number(produtoCategoria.value);
    const preco = Number(produtoPreco.value);
    const imagem = produtoImagem.value.trim();

    if (!nome) {
      alert("Informe o nome do produto.");
      produtoNome.focus();
      return;
    }

    if (!categoria_id) {
      alert("Selecione uma categoria.");
      produtoCategoria.focus();
      return;
    }

    const categoriaExiste = categorias.some(
      (categoria) => Number(categoria.id) === categoria_id,
    );

    if (!categoriaExiste) {
      alert("A categoria selecionada não existe mais.");
      produtoCategoria.focus();
      return;
    }

    if (!Number.isFinite(preco) || preco < 0) {
      alert("Informe um preço válido.");
      produtoPreco.focus();
      return;
    }

    if (imagem) {
      try {
        new URL(imagem);
      } catch {
        alert("Informe uma URL válida para a imagem.");
        produtoImagem.focus();
        return;
      }
    }

    const dados = {
      nome,
      categoria_id,
      descricao: produtoDescricao.value.trim(),
      preco,
      imagem,
      disponivel: produtoDisponivel.checked,
    };

    const id = produtoId.value;

    btnSalvarProduto.disabled = true;

    try {
      if (id) {
        await requisicao(`${API_PRODUTOS}/${encodeURIComponent(id)}`, {
          method: "PUT",
          body: JSON.stringify(dados),
        });
      } else {
        await requisicao(API_PRODUTOS, {
          method: "POST",
          body: JSON.stringify(dados),
        });
      }

      fecharModalProduto();

      await carregarProdutos();

      alert(
        id
          ? "Produto atualizado com sucesso!"
          : "Produto cadastrado com sucesso!",
      );
    } catch (erro) {
      console.error("[CARDÁPIO] Erro ao salvar produto:", erro);
      alert(erro.message);
    } finally {
      btnSalvarProduto.disabled = false;
    }
  });

  // ======================================================
  // EXCLUIR PRODUTO
  // ======================================================

  function prepararExclusaoProduto(produto) {
    produtoParaExcluir = produto;

    deleteProdutoNome.textContent = produto.nome || "Produto";

    abrirModal(modalDeleteProduto);
  }

  function fecharModalDeleteProduto() {
    fecharModal(modalDeleteProduto);
    produtoParaExcluir = null;
  }

  if (btnCancelarDeleteProduto) {
    btnCancelarDeleteProduto.addEventListener(
      "click",
      fecharModalDeleteProduto,
    );
  }

  modalDeleteProduto.addEventListener("click", (event) => {
    if (event.target === modalDeleteProduto) {
      fecharModalDeleteProduto();
    }
  });

  btnConfirmarDeleteProduto.addEventListener("click", async () => {
    if (!produtoParaExcluir) {
      return;
    }

    btnConfirmarDeleteProduto.disabled = true;

    try {
      await requisicao(
        `${API_PRODUTOS}/${encodeURIComponent(produtoParaExcluir.id)}`,
        {
          method: "DELETE",
        },
      );

      fecharModalDeleteProduto();

      await carregarProdutos();

      alert("Produto excluído com sucesso!");
    } catch (erro) {
      console.error("[CARDÁPIO] Erro ao excluir produto:", erro);

      alert(erro.message);
    } finally {
      btnConfirmarDeleteProduto.disabled = false;
    }
  });

  // ======================================================
  // MODAL DE CATEGORIA
  // ======================================================

  function abrirModalCategoria() {
    abrirModal(modalCategoria);
  }

  function fecharModalCategoria() {
    fecharModal(modalCategoria);

    formCategoria.reset();

    categoriaId.value = "";
    categoriaAtivo.checked = true;
  }

  function novaCategoria() {
    formCategoria.reset();

    categoriaId.value = "";
    categoriaAtivo.checked = true;

    modalCategoriaTitulo.textContent = "Nova Categoria";
    btnSalvarCategoria.textContent = "Salvar Categoria";

    abrirModalCategoria();
  }

  function editarCategoria(categoria) {
    formCategoria.reset();

    categoriaId.value = categoria.id;
    categoriaNome.value = categoria.nome || "";
    categoriaDescricao.value = categoria.descricao || "";
    categoriaAtivo.checked = categoriaEstaAtiva(categoria.ativo);

    modalCategoriaTitulo.textContent = "Editar Categoria";
    btnSalvarCategoria.textContent = "Salvar Alterações";

    abrirModalCategoria();
  }

  if (btnNovaCategoria) {
    btnNovaCategoria.addEventListener("click", novaCategoria);
  }

  if (btnPrimeiraCategoria) {
    btnPrimeiraCategoria.addEventListener("click", novaCategoria);
  }

  if (btnFecharCategoria) {
    btnFecharCategoria.addEventListener("click", fecharModalCategoria);
  }

  if (btnCancelarCategoria) {
    btnCancelarCategoria.addEventListener("click", fecharModalCategoria);
  }

  modalCategoria.addEventListener("click", (event) => {
    if (event.target === modalCategoria) {
      fecharModalCategoria();
    }
  });

  // ======================================================
  // SALVAR CATEGORIA
  // ======================================================

  formCategoria.addEventListener("submit", async (event) => {
    event.preventDefault();

    const nome = categoriaNome.value.trim();
    const descricao = categoriaDescricao.value.trim();

    if (!nome) {
      alert("Informe o nome da categoria.");
      categoriaNome.focus();
      return;
    }

    const dados = {
      nome,
      descricao,
      ativo: categoriaAtivo.checked,
    };

    const id = categoriaId.value;

    btnSalvarCategoria.disabled = true;

    try {
      if (id) {
        await requisicao(`${API_CATEGORIAS}/${encodeURIComponent(id)}`, {
          method: "PUT",
          body: JSON.stringify(dados),
        });
      } else {
        await requisicao(API_CATEGORIAS, {
          method: "POST",
          body: JSON.stringify(dados),
        });
      }

      fecharModalCategoria();

      await carregarCategorias();
      await carregarProdutos();

      alert(
        id
          ? "Categoria atualizada com sucesso!"
          : "Categoria cadastrada com sucesso!",
      );
    } catch (erro) {
      console.error("[CARDÁPIO] Erro ao salvar categoria:", erro);

      alert(erro.message);
    } finally {
      btnSalvarCategoria.disabled = false;
    }
  });

  // ======================================================
  // EXCLUIR CATEGORIA
  // ======================================================

  function prepararExclusaoCategoria(categoria) {
    categoriaParaExcluir = categoria;

    deleteCategoriaNome.textContent = categoria.nome || "Categoria";

    abrirModal(modalDeleteCategoria);
  }

  function fecharModalDeleteCategoria() {
    fecharModal(modalDeleteCategoria);
    categoriaParaExcluir = null;
  }

  if (btnCancelarDeleteCategoria) {
    btnCancelarDeleteCategoria.addEventListener(
      "click",
      fecharModalDeleteCategoria,
    );
  }

  modalDeleteCategoria.addEventListener("click", (event) => {
    if (event.target === modalDeleteCategoria) {
      fecharModalDeleteCategoria();
    }
  });

  btnConfirmarDeleteCategoria.addEventListener("click", async () => {
    if (!categoriaParaExcluir) {
      return;
    }

    btnConfirmarDeleteCategoria.disabled = true;

    try {
      await requisicao(
        `${API_CATEGORIAS}/${encodeURIComponent(categoriaParaExcluir.id)}`,
        {
          method: "DELETE",
        },
      );

      fecharModalDeleteCategoria();

      await carregarCategorias();
      await carregarProdutos();

      alert("Categoria excluída com sucesso!");
    } catch (erro) {
      console.error("[CARDÁPIO] Erro ao excluir categoria:", erro);

      alert(erro.message);
    } finally {
      btnConfirmarDeleteCategoria.disabled = false;
    }
  });

  // ======================================================
  // FECHAR MODAIS COM ESC
  // ======================================================

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;

    if (modalProduto.classList.contains("show")) {
      fecharModalProduto();
    }

    if (modalDeleteProduto.classList.contains("show")) {
      fecharModalDeleteProduto();
    }

    if (modalCategoria.classList.contains("show")) {
      fecharModalCategoria();
    }

    if (modalDeleteCategoria.classList.contains("show")) {
      fecharModalDeleteCategoria();
    }
  });

  // ======================================================
  // BUSCA E FILTROS
  // ======================================================

  if (buscaProduto) {
    buscaProduto.addEventListener("input", renderizarProdutos);
  }

  if (filtroCategoria) {
    filtroCategoria.addEventListener("change", renderizarProdutos);
  }

  if (filtroStatusProduto) {
    filtroStatusProduto.addEventListener("change", renderizarProdutos);
  }

  if (buscaCategoria) {
    buscaCategoria.addEventListener("input", renderizarCategorias);
  }

  if (filtroStatusCategoria) {
    filtroStatusCategoria.addEventListener("change", renderizarCategorias);
  }

  // ======================================================
  // MENU MOBILE
  // ======================================================

  if (adminNavToggle && adminNav) {
    adminNavToggle.addEventListener("click", () => {
      const aberto = adminNav.classList.toggle("show");

      adminNavToggle.setAttribute("aria-expanded", String(aberto));
    });

    adminNav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        adminNav.classList.remove("show");

        adminNavToggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  // ======================================================
  // MENU DO USUÁRIO
  // ======================================================

  if (userButton && userDropdown) {
    userButton.addEventListener("click", (event) => {
      event.stopPropagation();

      const aberto = userDropdown.classList.toggle("show");

      userButton.setAttribute("aria-expanded", String(aberto));
    });

    document.addEventListener("click", (event) => {
      if (userMenu && !userMenu.contains(event.target)) {
        userDropdown.classList.remove("show");

        userButton.setAttribute("aria-expanded", "false");
      }
    });
  }

  // ======================================================
  // LOGOUT
  // ======================================================

  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      logoutBtn.disabled = true;

      try {
        await requisicao(`${API_AUTH}/logout`, {
          method: "POST",
        });

        window.location.href = "/admin/admin-login.html";
      } catch (erro) {
        console.error("[CARDÁPIO] Erro ao sair:", erro);

        alert(erro.message);

        logoutBtn.disabled = false;
      }
    });
  }

  // ======================================================
  // CARREGAR USUÁRIO
  // ======================================================

  async function carregarUsuario() {
    try {
      const dados = await requisicao(`${API_AUTH}/me`);

      const usuario = dados.usuario || dados;

      const nome =
        usuario.nome || usuario.name || usuario.email || "Administrador";

      if (userName) {
        userName.textContent = nome;
      }

      if (dropdownUserName) {
        dropdownUserName.textContent = nome;
      }

      if (userAvatar) {
        userAvatar.textContent = nome.charAt(0).toUpperCase();
      }

      if (dropdownUserRole) {
        dropdownUserRole.textContent =
          usuario.tipo === "admin"
            ? "Administrador"
            : usuario.tipo || "Administrador";
      }
    } catch (erro) {
      console.error("[CARDÁPIO] Não foi possível carregar o usuário:", erro);
    }
  }

  // ======================================================
  // INICIALIZAÇÃO
  // ======================================================

  async function iniciarPagina() {
    console.log("[CARDÁPIO] Inicializando...");

    try {
      await carregarUsuario();
      await carregarCategorias();
      await carregarProdutos();

      console.log("[CARDÁPIO] Produtos e categorias carregados com sucesso.");
    } catch (erro) {
      console.error("[CARDÁPIO] Erro na inicialização:", erro);
    }
  }

  iniciarPagina();
});



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

