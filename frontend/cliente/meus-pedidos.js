"use strict";

// ======================================================
// CONFIGURAÇÕES
// ======================================================

const API = "/api/pedidos";

const STATUS_CANCELAVEIS = ["novo", "em_preparo"];

// ======================================================
// ELEMENTOS
// ======================================================

const tabelaPedidos = document.getElementById("tbodyPedidos");
const filtroStatus = document.getElementById("filtroStatus");
const dataInicio = document.getElementById("dataInicio");
const dataFim = document.getElementById("dataFim");
const btnLimparFiltros = document.getElementById("btnLimparFiltros");

const pedidoModal = document.getElementById("pedidoModal");
const pedidoModalBody = document.getElementById("pedidoModalBody");
const pedidoModalClose = document.getElementById("pedidoModalClose");
const pedidoModalFechar = document.getElementById("pedidoModalFechar");
const pedidoModalCancelar = document.getElementById("pedidoModalCancelar");

// ======================================================
// ESTADO
// ======================================================

let pedidos = [];
let pedidoAtualId = null;

// ======================================================
// FUNÇÕES AUXILIARES
// ======================================================

function escaparHTML(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, (caractere) => {
    const entidades = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };

    return entidades[caractere];
  });
}

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatarData(valor) {
  if (!valor) return "-";

  const data = new Date(valor);

  if (Number.isNaN(data.getTime())) return "-";

  return data.toLocaleString("pt-BR");
}

function normalizarStatus(status) {
  return String(status || "")
    .trim()
    .toLowerCase();
}

function podeCancelarPedido(status) {
  return STATUS_CANCELAVEIS.includes(normalizarStatus(status));
}

function obterMensagemErro(dados, resposta) {
  return (
    dados?.erro ||
    dados?.mensagem ||
    dados?.message ||
    `Erro HTTP ${resposta.status}`
  );
}

function parsePersonalizacao(valor) {
  if (Array.isArray(valor)) return valor;

  if (!valor) return [];

  try {
    const resultado = JSON.parse(valor);
    return Array.isArray(resultado) ? resultado : [];
  } catch (erro) {
    console.error("Erro ao interpretar personalização:", erro);
    return [];
  }
}

function obterDataPedido(pedido) {
  return (
    pedido.data_pedido ||
    pedido.data_criacao ||
    pedido.created_at ||
    pedido.data
  );
}

function obterTotalPedido(pedido) {
  return pedido.total ?? pedido.valor_total ?? 0;
}

// ======================================================
// REQUISIÇÕES
// ======================================================

async function requisicao(url, opcoes = {}) {
  const configuracao = {
    credentials: "same-origin",
    cache: "no-store",
    ...opcoes,
    headers: {
      Accept: "application/json",
      ...(opcoes.body ? { "Content-Type": "application/json" } : {}),
      ...(opcoes.headers || {}),
    },
  };

  const resposta = await fetch(url, configuracao);

  let dados = {};

  try {
    dados = await resposta.json();
  } catch {
    dados = {};
  }

  if (resposta.status === 401) {
    window.location.href = "/cadastro/login.html";
    throw new Error("Sua sessão expirou. Entre novamente.");
  }

  if (!resposta.ok) {
    throw new Error(obterMensagemErro(dados, resposta));
  }

  return dados;
}

// ======================================================
// NOTIFICAÇÕES
// ======================================================

function mostrarMensagem(mensagem, tipo = "info") {
  let elemento = document.getElementById("mensagemPedidos");

  if (!elemento) {
    elemento = document.createElement("div");
    elemento.id = "mensagemPedidos";

    elemento.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 99999;
      max-width: 380px;
      padding: 14px 18px;
      border-radius: 8px;
      color: white;
      font-size: 14px;
      box-shadow: 0 4px 15px rgba(0,0,0,.25);
    `;

    document.body.appendChild(elemento);
  }

  const cores = {
    sucesso: "#198754",
    erro: "#dc3545",
    info: "#343a40",
  };

  elemento.style.background = cores[tipo] || cores.info;
  elemento.textContent = mensagem;
  elemento.style.display = "block";

  clearTimeout(elemento._temporizador);

  elemento._temporizador = setTimeout(() => {
    elemento.style.display = "none";
  }, 4500);
}

// ======================================================
// CARREGAR PEDIDOS
// ======================================================

async function carregarPedidos() {
  if (!tabelaPedidos) return;

  tabelaPedidos.innerHTML = `
    <tr>
      <td colspan="6">Carregando pedidos...</td>
    </tr>
  `;

  try {
    const dados = await requisicao(`${API}/meus`);

    pedidos = Array.isArray(dados)
      ? dados
      : Array.isArray(dados.pedidos)
        ? dados.pedidos
        : [];

    renderizarPedidos();
  } catch (erro) {
    console.error("Erro ao carregar pedidos:", erro);

    tabelaPedidos.innerHTML = `
      <tr>
        <td colspan="6">${escaparHTML(erro.message)}</td>
      </tr>
    `;
  }
}

// ======================================================
// RENDERIZAR PEDIDOS
// ======================================================

function renderizarPedidos() {
  if (!tabelaPedidos) return;

  const statusSelecionado = normalizarStatus(filtroStatus?.value);
  const inicio = dataInicio?.value || "";
  const fim = dataFim?.value || "";

  const filtrados = pedidos.filter((pedido) => {
    const statusPedido = normalizarStatus(pedido.status);

    if (statusSelecionado && statusPedido !== statusSelecionado) {
      return false;
    }

    const dataPedido = obterDataPedido(pedido);

    if (inicio && dataPedido) {
      const data = new Date(dataPedido);

      if (data < new Date(`${inicio}T00:00:00`)) {
        return false;
      }
    }

    if (fim && dataPedido) {
      const data = new Date(dataPedido);

      if (data > new Date(`${fim}T23:59:59`)) {
        return false;
      }
    }

    return true;
  });

  if (!filtrados.length) {
    tabelaPedidos.innerHTML = `
      <tr>
        <td colspan="6">Nenhum pedido encontrado.</td>
      </tr>
    `;

    return;
  }

  tabelaPedidos.innerHTML = filtrados
    .map(
      (pedido) => `
        <tr>
          <td>#${escaparHTML(pedido.id)}</td>

          <td>${formatarData(obterDataPedido(pedido))}</td>

          <td>${formatarMoeda(obterTotalPedido(pedido))}</td>

          <td>${escaparHTML(pedido.status || "-")}</td>

          <td>${escaparHTML(pedido.forma_pagamento || "-")}</td>

          <td>
            <button
              type="button"
              class="btn btn-primary btn-ver-pedido"
              data-id="${escaparHTML(pedido.id)}"
            >
              Ver detalhes
            </button>
          </td>
        </tr>
      `,
    )
    .join("");
}

// ======================================================
// RENDERIZAR ITENS DO PEDIDO
// ======================================================

function renderizarItens(itens) {
  if (!Array.isArray(itens) || !itens.length) {
    return "<p>Nenhum item encontrado.</p>";
  }

  return `
    <ul class="lista-itens-pedido">
      ${itens
        .map((item) => {
          const quantidade = Number(item.quantidade || 1);

          const nome = item.nome_produto || item.nome || "Produto";

          const subtotal = Number(
            item.subtotal ??
              Number(item.preco_unitario || item.preco || 0) * quantidade,
          );

          const adicionais = parsePersonalizacao(item.personalizacao);

          return `
            <li class="item-pedido-detalhe">

              <div class="item-pedido-principal">
                <strong>
                  ${escaparHTML(quantidade)}x
                  ${escaparHTML(nome)}
                </strong>

                <span>
                  ${formatarMoeda(subtotal)}
                </span>
              </div>

              ${
                adicionais.length
                  ? `
                    <ul class="lista-adicionais-pedido">
                      ${adicionais
                        .map(
                          (adicional) => `
                            <li>
                              + ${escaparHTML(adicional.nome || adicional.nome_adicional || "Adicional")}
                              — ${formatarMoeda(adicional.preco)}
                            </li>
                          `,
                        )
                        .join("")}
                    </ul>
                  `
                  : ""
              }

            </li>
          `;
        })
        .join("")}
    </ul>
  `;
}

// ======================================================
// RENDERIZAR HISTÓRICO
// ======================================================

function renderizarHistorico(historico) {
  if (!Array.isArray(historico) || !historico.length) {
    return "<p>Nenhum histórico disponível.</p>";
  }

  return `
    <ul class="lista-historico-pedido">
      ${historico
        .map((item) => {
          const statusAnterior = item.status_anterior;
          const statusNovo = item.status_novo || item.status;

          const descricao = statusAnterior
            ? `${statusAnterior} → ${statusNovo}`
            : `Pedido registrado: ${statusNovo}`;

          return `
            <li>
              <strong>${escaparHTML(descricao)}</strong>

              <span>
                ${formatarData(item.data_alteracao)}
              </span>
            </li>
          `;
        })
        .join("")}
    </ul>
  `;
}

// ======================================================
// DETALHES DO PEDIDO
// ======================================================

async function abrirDetalhes(id) {
  try {
    const dados = await requisicao(`${API}/${encodeURIComponent(id)}`);

    // O backend retorna pedido, itens e historico separadamente.
    const pedido = dados.pedido || dados;

    // Compatibilidade com o formato atual do backend.
    const itens = Array.isArray(dados.itens)
      ? dados.itens
      : Array.isArray(pedido.itens)
        ? pedido.itens
        : [];

    const historico = Array.isArray(dados.historico)
      ? dados.historico
      : Array.isArray(pedido.historico)
        ? pedido.historico
        : [];

    pedidoAtualId = pedido.id;

    atualizarBotaoCancelar(pedido);

    pedidoModalBody.innerHTML = `
      <div class="pedido-detalhes">

        <h3>Pedido #${escaparHTML(pedido.id)}</h3>

        <p>
          <strong>Status:</strong>
          ${escaparHTML(pedido.status || "-")}
        </p>

        <p>
          <strong>Data:</strong>
          ${formatarData(obterDataPedido(pedido))}
        </p>

        <p>
          <strong>Subtotal:</strong>
          ${formatarMoeda(pedido.subtotal)}
        </p>

        <p>
          <strong>Entrega:</strong>
          ${formatarMoeda(pedido.taxa_entrega)}
        </p>

        <p>
          <strong>Total:</strong>
          ${formatarMoeda(obterTotalPedido(pedido))}
        </p>

        <p>
          <strong>Pagamento:</strong>
          ${escaparHTML(pedido.forma_pagamento || "-")}
        </p>

        <p>
          <strong>Status do pagamento:</strong>
          ${escaparHTML(pedido.status_pagamento || "-")}
        </p>

        <hr>

        <h4>Itens do pedido</h4>

        ${renderizarItens(itens)}

        <hr>

        <h4>Histórico</h4>

        ${renderizarHistorico(historico)}

      </div>
    `;

    pedidoModal?.classList.remove("hidden");
  } catch (erro) {
    console.error("Erro ao abrir detalhes:", erro);

    mostrarMensagem(erro.message, "erro");
  }
}

// ======================================================
// BOTÃO CANCELAR
// ======================================================

function atualizarBotaoCancelar(pedido) {
  if (!pedidoModalCancelar) return;

  const cancelavel = podeCancelarPedido(pedido.status);

  pedidoModalCancelar.classList.toggle("hidden", !cancelavel);
  pedidoModalCancelar.disabled = !cancelavel;
  pedidoModalCancelar.textContent = "Cancelar Pedido";
}

// ======================================================
// CANCELAR PEDIDO
// ======================================================

async function cancelarPedidoAtual() {
  if (!pedidoAtualId) {
    mostrarMensagem("Nenhum pedido selecionado.", "erro");
    return;
  }

  const confirmado = window.confirm(
    "Tem certeza de que deseja cancelar este pedido?",
  );

  if (!confirmado) return;

  const motivoInformado = window.prompt(
    "Informe o motivo do cancelamento (opcional):",
  );

  if (motivoInformado === null) return;

  const motivo = motivoInformado.trim() || "Cancelado pelo cliente";

  const url = `${API}/${encodeURIComponent(pedidoAtualId)}/cancelar`;

  pedidoModalCancelar.disabled = true;
  pedidoModalCancelar.textContent = "Cancelando...";

  try {
    await requisicao(url, {
      method: "PATCH",
      body: JSON.stringify({ motivo }),
    });

    mostrarMensagem("Pedido cancelado com sucesso!", "sucesso");

    await carregarPedidos();
    await abrirDetalhes(pedidoAtualId);
  } catch (erro) {
    console.error("Erro ao cancelar pedido:", erro);

    mostrarMensagem(`Não foi possível cancelar: ${erro.message}`, "erro");

    pedidoModalCancelar.disabled = false;
    pedidoModalCancelar.textContent = "Cancelar Pedido";
  }
}

// ======================================================
// MODAL
// ======================================================

function fecharModal() {
  pedidoAtualId = null;

  pedidoModal?.classList.add("hidden");

  if (pedidoModalCancelar) {
    pedidoModalCancelar.classList.add("hidden");
    pedidoModalCancelar.disabled = false;
  }
}

// ======================================================
// EVENTOS
// ======================================================

tabelaPedidos?.addEventListener("click", (evento) => {
  const botao = evento.target.closest(".btn-ver-pedido");

  if (!botao) return;

  abrirDetalhes(botao.dataset.id);
});

pedidoModalCancelar?.addEventListener("click", cancelarPedidoAtual);

pedidoModalClose?.addEventListener("click", fecharModal);
pedidoModalFechar?.addEventListener("click", fecharModal);

pedidoModal?.addEventListener("click", (evento) => {
  if (evento.target === pedidoModal) {
    fecharModal();
  }
});

filtroStatus?.addEventListener("change", renderizarPedidos);
dataInicio?.addEventListener("change", renderizarPedidos);
dataFim?.addEventListener("change", renderizarPedidos);

btnLimparFiltros?.addEventListener("click", () => {
  if (filtroStatus) filtroStatus.value = "";
  if (dataInicio) dataInicio.value = "";
  if (dataFim) dataFim.value = "";

  renderizarPedidos();
});

// ======================================================
// INICIALIZAÇÃO
// ======================================================

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", carregarPedidos);
} else {
  carregarPedidos();
}
