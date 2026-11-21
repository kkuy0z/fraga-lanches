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

  function injetarEstilosWidget() {
    if (document.getElementById("fragaCarrinhoWidgetStyles")) return;

    const style = document.createElement("style");
    style.id = "fragaCarrinhoWidgetStyles";
    style.textContent = `
      #fragaCarrinhoWidget.fraga-carrinho-widget {
        --cardapio-yellow: #f5c542;
        --cardapio-yellow-hover: #ffda65;
        --cardapio-border: rgba(255, 255, 255, 0.1);
        position: fixed;
        right: 22px;
        bottom: 22px;
        left: auto;
        top: auto;
        z-index: 950;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 12px;
        width: fit-content;
        min-height: 0;
        height: auto;
        margin: 0;
        padding: 0;
        max-width: calc(100vw - 32px);
        font-family: "Montserrat", sans-serif;
        box-sizing: border-box;
      }

      #fragaCarrinhoWidget .fraga-carrinho-barra {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        width: fit-content;
        min-height: 0;
        height: auto;
        margin: 0;
        padding: 10px 14px 10px 16px;
        border: 1px solid rgba(245, 197, 66, 0.45);
        border-radius: 999px;
        background-color: #191919;
        color: #f5f5f5;
        box-shadow: 0 14px 34px rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(8px);
        box-sizing: border-box;
      }

      #fragaCarrinhoWidget .fraga-carrinho-resumo {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
      }

      #fragaCarrinhoWidget .fraga-carrinho-icone {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 34px;
        height: 34px;
        flex-shrink: 0;
        border-radius: 50%;
        background-color: rgba(245, 197, 66, 0.14);
        font-size: 16px;
        line-height: 1;
      }

      #fragaCarrinhoWidget .fraga-carrinho-informacoes {
        display: flex;
        flex-direction: column;
        gap: 1px;
        min-width: 0;
      }

      #fragaCarrinhoWidget .fraga-carrinho-titulo {
        color: #ffffff;
        font-size: 12px;
        font-weight: 700;
        line-height: 1.2;
        white-space: nowrap;
      }

      #fragaCarrinhoWidget .fraga-carrinho-quantidade {
        color: #a5a5a5;
        font-size: 11px;
        font-weight: 500;
        line-height: 1.2;
        white-space: nowrap;
      }

      #fragaCarrinhoWidget .fraga-carrinho-total {
        color: var(--cardapio-yellow);
        font-size: 14px;
        font-weight: 700;
        line-height: 1.2;
        white-space: nowrap;
      }

      #fragaCarrinhoWidget .fraga-carrinho-abrir {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: auto;
        min-height: 0;
        height: auto;
        margin: 0;
        padding: 9px 16px;
        border: 1px solid var(--cardapio-yellow);
        border-radius: 999px;
        background-color: var(--cardapio-yellow);
        color: #141414;
        font-family: "Montserrat", sans-serif;
        font-size: 11px;
        font-weight: 700;
        line-height: 1;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        white-space: nowrap;
        cursor: pointer;
        transition: background-color 0.2s ease, transform 0.2s ease;
        box-sizing: border-box;
      }

      #fragaCarrinhoWidget .fraga-carrinho-abrir:hover {
        background-color: var(--cardapio-yellow-hover);
        transform: translateY(-1px);
      }

      #fragaCarrinhoWidget .fraga-carrinho-painel {
        width: 370px;
        max-width: calc(100vw - 32px);
        max-height: 72vh;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        margin: 0;
        padding: 0;
        border: 1px solid #2f2f2f;
        border-radius: 14px;
        background-color: #191919;
        color: #f5f5f5;
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.72);
        box-sizing: border-box;
      }

      #fragaCarrinhoWidget .fraga-carrinho-painel[hidden] {
        display: none;
      }

      #fragaCarrinhoWidget .fraga-carrinho-painel-cabecalho {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 18px;
        border-bottom: 1px solid var(--cardapio-border);
        background-color: #141414;
      }

      #fragaCarrinhoWidget .fraga-carrinho-painel-cabecalho h2 {
        margin: 0;
        color: #ffffff;
        font-family: "Anton", sans-serif;
        font-size: 22px;
        font-weight: 400;
        letter-spacing: 0.03em;
        text-transform: uppercase;
      }

      #fragaCarrinhoWidget .fraga-carrinho-fechar {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        padding: 0;
        border: 1px solid #333333;
        border-radius: 8px;
        background-color: #1c1c1c;
        color: #d8d8d8;
        font-size: 18px;
        line-height: 1;
        cursor: pointer;
      }

      #fragaCarrinhoWidget .fraga-carrinho-fechar:hover {
        border-color: var(--cardapio-yellow);
        color: var(--cardapio-yellow);
      }

      #fragaCarrinhoWidget .fraga-carrinho-lista {
        flex: 1 1 auto;
        overflow-y: auto;
        padding: 12px 18px;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      #fragaCarrinhoWidget .fraga-carrinho-vazio {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: 6px;
        padding: 28px 12px;
        color: #a5a5a5;
      }

      #fragaCarrinhoWidget .fraga-carrinho-vazio span {
        font-size: 26px;
      }

      #fragaCarrinhoWidget .fraga-carrinho-vazio strong {
        color: #ffffff;
        font-size: 13px;
      }

      #fragaCarrinhoWidget .fraga-carrinho-vazio p {
        margin: 0;
        font-size: 12px;
        line-height: 1.45;
      }

      #fragaCarrinhoWidget .fraga-carrinho-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 12px;
        border: 1px solid var(--cardapio-border);
        border-radius: 10px;
        background-color: #121212;
      }

      #fragaCarrinhoWidget .fraga-carrinho-item-dados {
        display: flex;
        flex-direction: column;
        gap: 3px;
        min-width: 0;
      }

      #fragaCarrinhoWidget .fraga-carrinho-item-nome {
        color: #ffffff;
        font-size: 12px;
        font-weight: 700;
        word-break: break-word;
      }

      #fragaCarrinhoWidget .fraga-carrinho-item-preco {
        color: var(--cardapio-yellow);
        font-size: 12px;
        font-weight: 600;
      }

      #fragaCarrinhoWidget .fraga-carrinho-controles {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        flex-shrink: 0;
      }

      #fragaCarrinhoWidget .fraga-carrinho-quantidade-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 26px;
        height: 26px;
        padding: 0;
        border: 1px solid #383838;
        border-radius: 6px;
        background-color: #1b1b1b;
        color: #ffffff;
        font-size: 13px;
        font-weight: 700;
        line-height: 1;
        cursor: pointer;
      }

      #fragaCarrinhoWidget .fraga-carrinho-quantidade-btn:hover:not(:disabled) {
        border-color: var(--cardapio-yellow);
        color: var(--cardapio-yellow);
      }

      #fragaCarrinhoWidget .fraga-carrinho-quantidade-btn:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }

      #fragaCarrinhoWidget .fraga-carrinho-item-quantidade {
        min-width: 18px;
        text-align: center;
        color: #ffffff;
        font-size: 12px;
        font-weight: 700;
      }

      #fragaCarrinhoWidget .fraga-carrinho-remover {
        padding: 5px 8px;
        border: 1px solid rgba(255, 107, 107, 0.35);
        border-radius: 6px;
        background-color: rgba(255, 107, 107, 0.1);
        color: #ff8b8b;
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        cursor: pointer;
      }

      #fragaCarrinhoWidget .fraga-carrinho-remover:hover:not(:disabled) {
        background-color: rgba(255, 107, 107, 0.22);
        color: #ffffff;
      }

      #fragaCarrinhoWidget .fraga-carrinho-remover:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }

      #fragaCarrinhoWidget .fraga-carrinho-painel-rodape {
        display: flex;
        gap: 12px;
        padding: 16px 18px;
        border-top: 1px solid var(--cardapio-border);
        background-color: #141414;
      }

      #fragaCarrinhoWidget .fraga-carrinho-painel-rodape > span {
        color: #a5a5a5;
        font-size: 12px;
        font-weight: 600;
      }

      #fragaCarrinhoWidget .fraga-carrinho-painel-rodape > strong {
        color: var(--cardapio-yellow);
        font-size: 16px;
        font-weight: 700;
      }

      #fragaCarrinhoWidget .fraga-carrinho-finalizar {
        width: 100%;
        min-height: 42px;
        padding: 10px 16px;
        border: 1px solid var(--cardapio-yellow);
        border-radius: 8px;
        background-color: var(--cardapio-yellow);
        color: #141414;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        cursor: pointer;
        transition: background-color 0.2s ease;
      }

      #fragaCarrinhoWidget .fraga-carrinho-finalizar:hover:not(:disabled) {
        background-color: var(--cardapio-yellow-hover);
      }

      #fragaCarrinhoWidget .fraga-carrinho-finalizar:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }

      @media (max-width: 520px) {
        #fragaCarrinhoWidget.fraga-carrinho-widget {
          right: 12px;
          bottom: 12px;
          left: 12px;
          align-items: stretch;
          width: auto;
          max-width: none;
        }

        #fragaCarrinhoWidget .fraga-carrinho-barra {
          width: 100%;
          gap: 10px;
          padding: 9px 12px;
        }

        #fragaCarrinhoWidget .fraga-carrinho-painel {
          width: 100%;
          max-width: none;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function aplicarEstadoCarrinho(novoCarrinho) {
    if (!novoCarrinho || typeof novoCarrinho !== "object") return;
    carrinho = {
      itens: Array.isArray(novoCarrinho.itens) ? novoCarrinho.itens : [],
      quantidade_itens: Number(novoCarrinho.quantidade_itens) || 0,
      total: Number(novoCarrinho.total) || 0,
    };
    renderizarCarrinho();
  }

  window.fragaAtualizarEstadoCarrinho = aplicarEstadoCarrinho;

  function criarCarrinhoWidget() {
    if (document.getElementById("fragaCarrinhoWidget")) return;

    injetarEstilosWidget();

    const widget = criarElemento("section", "fraga-carrinho-widget");
    widget.id = "fragaCarrinhoWidget";

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

    const linhaTotal = criarElemento("div", "");
    linhaTotal.style.display = "flex";
    linhaTotal.style.alignItems = "center";
    linhaTotal.style.justifyContent = "space-between";
    linhaTotal.style.gap = "8px";

    const totalLabel = criarElemento("span", "", "Total");
    totalLabel.style.color = "#a5a5a5";
    totalLabel.style.fontSize = "12px";
    totalLabel.style.fontWeight = "600";

    const totalPainel = criarElemento("strong", "", formatarPreco(0));
    totalPainel.id = "fragaCarrinhoTotalPainel";
    totalPainel.style.color = "#f5c542";
    totalPainel.style.fontSize = "16px";

    linhaTotal.append(totalLabel, totalPainel);

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

    rodape.append(linhaTotal, botaoFinalizar);
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

    quantidade.textContent = `${quantidadeTotal} ${
      quantidadeTotal === 1 ? "item" : "itens"
    }`;

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

      // Nome do produto
      const nome = criarElemento(
        "strong",
        "fraga-carrinho-item-nome",
        item.nome || "Produto",
      );

      // Adicionais selecionados
      const adicionais = Array.isArray(item.adicionais) ? item.adicionais : [];

      const totalAdicionais = adicionais.reduce(
        (soma, adicional) => soma + (Number(adicional.preco) || 0),
        0,
      );

      // Preço unitário considerando produto + adicionais
      const precoUnitario = Number(
        item.preco_unitario ?? Number(item.preco || 0) + totalAdicionais,
      );

      // Subtotal considerando a quantidade
      const subtotal = Number(
        item.subtotal ?? precoUnitario * Number(item.quantidade || 1),
      );

      // Informações dos adicionais
      if (adicionais.length > 0) {
        const listaAdicionais = criarElemento(
          "div",
          "fraga-carrinho-adicionais",
        );

        listaAdicionais.style.display = "flex";
        listaAdicionais.style.flexDirection = "column";
        listaAdicionais.style.gap = "3px";
        listaAdicionais.style.marginTop = "5px";

        adicionais.forEach((adicional) => {
          const detalhe = criarElemento(
            "span",
            "",
            `+ ${adicional.nome} (${formatarPreco(adicional.preco)})`,
          );

          detalhe.style.color = "#b5b5b5";
          detalhe.style.fontSize = "10px";

          listaAdicionais.appendChild(detalhe);
        });

        dados.append(nome, listaAdicionais);
      } else {
        dados.appendChild(nome);
      }

      // Preço unitário e subtotal
      const preco = criarElemento(
        "span",
        "fraga-carrinho-item-preco",
        `${formatarPreco(precoUnitario)} cada`,
      );

      const subtotalTexto = criarElemento(
        "span",
        "",
        `Subtotal: ${formatarPreco(subtotal)}`,
      );

      subtotalTexto.style.color = "#a5a5a5";
      subtotalTexto.style.fontSize = "10px";
      subtotalTexto.style.marginTop = "3px";

      dados.append(preco, subtotalTexto);

      // Controles de quantidade
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
        throw new Error(`HTTP ${resposta.status} ao carregar carrinho.`);
      }

      const dados = await resposta.json();
      aplicarEstadoCarrinho(dados.carrinho || dados);
    } catch (erro) {
      console.error("Erro ao carregar carrinho:", erro);
    }
  }

  window.fragaRecarregarCarrinho = carregarCarrinho;

  window.addEventListener("fraga:carrinho-atualizado", () => {
    carregarCarrinho();
  });

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

      aplicarEstadoCarrinho(dados.carrinho || dados);
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

  criarCarrinhoWidget();
  carregarCarrinho();
});
