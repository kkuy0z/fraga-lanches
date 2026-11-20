"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const API_URL = "/api/cliente/carrinho";

  let carrinho = {
    itens: [],
    quantidade_itens: 0,
    total: 0,
  };

  let carrinhoAberto = false;
  let atualizando = false;

  const formatarPreco = (valor) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(Number(valor) || 0);
  };

  const criarElemento = (tag, classe, texto) => {
    const elemento = document.createElement(tag);

    if (classe) elemento.className = classe;
    if (texto !== undefined) elemento.textContent = texto;

    return elemento;
  };

  function criarCarrinhoWidget() {
    if (document.getElementById("fragaCarrinhoWidget")) return;

    const widget = criarElemento("section", "fraga-carrinho-widget");
    widget.id = "fragaCarrinhoWidget";

    // Variáveis necessárias para o CSS funcionar fora do cardápio.
    widget.style.setProperty("--cardapio-yellow", "#ffc107");
    widget.style.setProperty("--cardapio-yellow-hover", "#e5ad00");
    widget.style.setProperty("--cardapio-border", "rgba(255,255,255,0.09)");

    const barra = criarElemento("div", "fraga-carrinho-barra");

    const resumo = criarElemento("div", "fraga-carrinho-resumo");
    const icone = criarElemento("span", "fraga-carrinho-icone", "🛒");

    const informacoes = criarElemento("div", "fraga-carrinho-informacoes");
    const titulo = criarElemento(
      "strong",
      "fraga-carrinho-titulo",
      "Meu carrinho",
    );

    const quantidade = criarElemento(
      "span",
      "fraga-carrinho-quantidade",
      "0 itens",
    );

    informacoes.append(titulo, quantidade);
    resumo.append(icone, informacoes);

    const total = criarElemento(
      "strong",
      "fraga-carrinho-total",
      formatarPreco(0),
    );

    const botaoAbrir = criarElemento(
      "button",
      "fraga-carrinho-abrir",
      "Ver carrinho",
    );

    botaoAbrir.type = "button";
    botaoAbrir.addEventListener("click", alternarCarrinho);

    barra.append(resumo, total, botaoAbrir);

    const painel = criarElemento("div", "fraga-carrinho-painel");
    painel.id = "fragaCarrinhoPainel";
    painel.hidden = true;

    const cabecalho = criarElemento("div", "fraga-carrinho-painel-cabecalho");

    const painelTitulo = criarElemento("h2", "", "Seu carrinho");

    const botaoFechar = criarElemento("button", "fraga-carrinho-fechar", "×");

    botaoFechar.type = "button";
    botaoFechar.setAttribute("aria-label", "Fechar carrinho");
    botaoFechar.addEventListener("click", alternarCarrinho);

    cabecalho.append(painelTitulo, botaoFechar);

    const lista = criarElemento("div", "fraga-carrinho-lista");
    lista.id = "fragaCarrinhoLista";

    const rodape = criarElemento("div", "fraga-carrinho-painel-rodape");

    const totalLabel = criarElemento("span", "", "Total");

    const totalPainel = criarElemento("strong", "", formatarPreco(0));

    totalPainel.id = "fragaCarrinhoTotalPainel";

    rodape.append(totalLabel, totalPainel);

    const botaoFinalizar = criarElemento(
      "button",
      "fraga-carrinho-finalizar",
      "Finalizar compra",
    );

    botaoFinalizar.type = "button";

    botaoFinalizar.addEventListener("click", () => {
      window.location.href = "/cliente/checkout.html";
    });

    rodape.style.flexDirection = "column";
    rodape.style.alignItems = "stretch";

    rodape.appendChild(botaoFinalizar);
    painel.append(cabecalho, lista, rodape);

    widget.append(painel, barra);
    document.body.appendChild(widget);

    renderizarCarrinho();
  }

  function alternarCarrinho() {
    carrinhoAberto = !carrinhoAberto;

    const painel = document.getElementById("fragaCarrinhoPainel");
    const botao = document.querySelector(".fraga-carrinho-abrir");

    if (!painel) return;

    painel.hidden = !carrinhoAberto;

    if (botao) {
      botao.textContent = carrinhoAberto ? "Fechar" : "Ver carrinho";
    }

    if (carrinhoAberto) {
      renderizarCarrinho();
    }
  }

  function renderizarCarrinho() {
    const widget = document.getElementById("fragaCarrinhoWidget");
    if (!widget) return;

    const quantidade = widget.querySelector(".fraga-carrinho-quantidade");

    const total = widget.querySelector(".fraga-carrinho-total");
    const lista = document.getElementById("fragaCarrinhoLista");
    const totalPainel = document.getElementById("fragaCarrinhoTotalPainel");

    if (!quantidade || !total || !lista || !totalPainel) return;

    const itens = Array.isArray(carrinho.itens) ? carrinho.itens : [];
    const quantidadeTotal = Number(carrinho.quantidade_itens) || 0;

    const botaoFinalizar = widget.querySelector(".fraga-carrinho-finalizar");

    if (botaoFinalizar) {
      botaoFinalizar.disabled = !itens.length || atualizando;
    }

    quantidade.textContent = `${quantidadeTotal} ${quantidadeTotal === 1 ? "item" : "itens"}`;

    total.textContent = formatarPreco(carrinho.total);
    totalPainel.textContent = formatarPreco(carrinho.total);

    lista.replaceChildren();

    if (!itens.length) {
      const vazio = criarElemento("div", "fraga-carrinho-vazio");

      vazio.append(
        criarElemento("span", "", "🛒"),
        criarElemento("strong", "", "Seu carrinho está vazio"),
        criarElemento("p", "", "Adicione seus produtos favoritos do cardápio."),
      );

      lista.appendChild(vazio);
      return;
    }

    itens.forEach((item) => {
      const linha = criarElemento("article", "fraga-carrinho-item");

      const dados = criarElemento("div", "fraga-carrinho-item-dados");

      const nome = criarElemento(
        "strong",
        "fraga-carrinho-item-nome",
        item.nome || "Produto",
      );

      const preco = criarElemento(
        "span",
        "fraga-carrinho-item-preco",
        formatarPreco(item.preco),
      );

      dados.append(nome, preco);

      const controles = criarElemento("div", "fraga-carrinho-controles");

      const diminuir = criarElemento(
        "button",
        "fraga-carrinho-quantidade-btn",
        "−",
      );

      diminuir.type = "button";
      diminuir.disabled = atualizando;
      diminuir.setAttribute("aria-label", "Diminuir quantidade");

      diminuir.addEventListener("click", () => {
        alterarQuantidade(item.id, Number(item.quantidade) - 1);
      });

      const numero = criarElemento(
        "span",
        "fraga-carrinho-item-quantidade",
        String(item.quantidade),
      );

      const aumentar = criarElemento(
        "button",
        "fraga-carrinho-quantidade-btn",
        "+",
      );

      aumentar.type = "button";
      aumentar.disabled = atualizando || Number(item.quantidade) >= 99;

      aumentar.setAttribute("aria-label", "Aumentar quantidade");

      aumentar.addEventListener("click", () => {
        alterarQuantidade(item.id, Number(item.quantidade) + 1);
      });

      const remover = criarElemento(
        "button",
        "fraga-carrinho-remover",
        "Remover",
      );

      remover.type = "button";
      remover.disabled = atualizando;

      remover.addEventListener("click", () => {
        removerItem(item.id);
      });

      controles.append(diminuir, numero, aumentar, remover);
      linha.append(dados, controles);
      lista.appendChild(linha);
    });
  }

  async function carregarCarrinho() {
    try {
      const resposta = await fetch(API_URL, {
        method: "GET",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
        },
        cache: "no-store",
      });

      if (resposta.status === 401) {
        window.location.href = "/cadastro/login.html";
        return;
      }

      if (!resposta.ok) {
        throw new Error("Não foi possível carregar o carrinho.");
      }

      carrinho = await resposta.json();
      renderizarCarrinho();
    } catch (erro) {
      console.error("Erro ao carregar carrinho:", erro);
    }
  }

  async function atualizarCarrinho(url, metodo, corpo = null) {
    if (atualizando) return;

    atualizando = true;
    renderizarCarrinho();

    try {
      const opcoes = {
        method: metodo,
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
        },
      };

      if (corpo !== null) {
        opcoes.headers["Content-Type"] = "application/json";
        opcoes.body = JSON.stringify(corpo);
      }

      const resposta = await fetch(url, opcoes);
      const dados = await resposta.json();

      if (!resposta.ok) {
        throw new Error(
          dados.mensagem || "Não foi possível atualizar o carrinho.",
        );
      }

      carrinho = dados.carrinho || dados;
      return true;
    } catch (erro) {
      console.error("Erro no carrinho:", erro);
      alert(erro.message);
      return false;
    } finally {
      atualizando = false;
      renderizarCarrinho();
    }
  }

  async function alterarQuantidade(itemId, quantidade) {
    if (quantidade <= 0) {
      await removerItem(itemId);
      return;
    }

    await atualizarCarrinho(
      `${API_URL}/itens/${encodeURIComponent(itemId)}`,
      "PATCH",
      { quantidade },
    );
  }

  async function removerItem(itemId) {
    await atualizarCarrinho(
      `${API_URL}/itens/${encodeURIComponent(itemId)}`,
      "DELETE",
    );
  }

  // Inicialização exclusiva do widget no painel.
  criarCarrinhoWidget();
  carregarCarrinho();
});

