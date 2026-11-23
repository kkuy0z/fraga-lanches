"use strict";

// ======================================================
// CONFIGURAÇÕES
// ======================================================

const API = "/api/pedidos";
const API_NOTIFICACOES = "/api/cliente/notificacoes";

const INTERVALO_FALLBACK = 15000;
const RECONEXAO_INICIAL = 1000;
const RECONEXAO_MAXIMA = 30000;

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
let notificacoes = [];
let pedidoAtualId = null;

let atualizacaoEmAndamento = false;

let conexaoWebSocket = null;
let temporizadorFallback = null;
let temporizadorReconexao = null;
let intervaloReconexao = RECONEXAO_INICIAL;

let reconexaoAgendada = false;

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

function statusTexto(status) {
  const statusMap = {
    novo: "Novo",
    em_preparo: "Em preparo",
    pronto: "Pronto",
    saiu_para_entrega: "Saiu para entrega",
    concluido: "Concluído",
    cancelado: "Cancelado",
  };

  return statusMap[normalizarStatus(status)] || status || "-";
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

function obterNotificacaoEntrega(pedidoId) {
  return notificacoes.find(
    (notificacao) =>
      Number(notificacao.pedido_id) === Number(pedidoId) &&
      notificacao.tipo === "entrega_informada",
  );
}

function podeConfirmarRecebimento(pedido) {
  return (
    normalizarStatus(pedido.status) === "saiu_para_entrega" &&
    Boolean(obterNotificacaoEntrega(pedido.id))
  );
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
// MENSAGENS
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
// CARREGAR NOTIFICAÇÕES
// ======================================================

async function carregarNotificacoes() {
  const dados = await requisicao(API_NOTIFICACOES);

  notificacoes = Array.isArray(dados)
    ? dados
    : Array.isArray(dados.notificacoes)
      ? dados.notificacoes
      : [];

  return notificacoes;
}

// ======================================================
// CARREGAR PEDIDOS
// ======================================================

async function carregarPedidos(silencioso = false) {
  if (!tabelaPedidos) return;

  if (!silencioso) {
    tabelaPedidos.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center;padding:24px">
          Carregando pedidos...
        </td>
      </tr>
    `;
  }

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

    if (!silencioso) {
      tabelaPedidos.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center;padding:24px">
            ${escaparHTML(erro.message)}
          </td>
        </tr>
      `;
    }
  }
}

// ======================================================
// ATUALIZAÇÃO DOS DADOS
// ======================================================

async function atualizarAcompanhamento() {
  if (atualizacaoEmAndamento) return;
  if (document.visibilityState !== "visible") return;

  atualizacaoEmAndamento = true;

  try {
    const notificacoesAnteriores = new Set(
      notificacoes
        .filter((item) => item.tipo === "entrega_informada")
        .map((item) => Number(item.pedido_id)),
    );

    await carregarNotificacoes();
    await carregarPedidos(true);

    const novasNotificacoes = notificacoes.filter(
      (item) =>
        item.tipo === "entrega_informada" &&
        !notificacoesAnteriores.has(Number(item.pedido_id)),
    );

    novasNotificacoes.forEach((notificacao) => {
      mostrarMensagem(
        `O entregador informou que o pedido #${notificacao.pedido_id} foi entregue. Confirme o recebimento.`,
        "sucesso",
      );
    });

    if (pedidoAtualId) {
      const pedidoAtual = pedidos.find(
        (pedido) => Number(pedido.id) === Number(pedidoAtualId),
      );

      if (
        pedidoAtual &&
        pedidoModal &&
        !pedidoModal.classList.contains("hidden")
      ) {
        atualizarBotaoCancelar(pedidoAtual);
      }
    }
  } catch (erro) {
    console.error("Erro ao atualizar acompanhamento:", erro);
  } finally {
    atualizacaoEmAndamento = false;
  }
}

// ======================================================
// WEBSOCKET
// ======================================================

function obterURLWebSocket() {
  const protocolo = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocolo}//${window.location.host}/ws`;
}

function conectarWebSocket() {
  if (document.visibilityState !== "visible") return;

  if (
    conexaoWebSocket &&
    (conexaoWebSocket.readyState === WebSocket.OPEN ||
      conexaoWebSocket.readyState === WebSocket.CONNECTING)
  ) {
    return;
  }

  if (reconexaoAgendada) return;

  reconexaoAgendada = true;

  try {
    const socket = new WebSocket(obterURLWebSocket());
    conexaoWebSocket = socket;

    socket.addEventListener("open", () => {
      console.log("[WebSocket] Conectado ao servidor.");

      reconexaoAgendada = false;
      intervaloReconexao = RECONEXAO_INICIAL;

      pararFallback();
      atualizarAcompanhamento();
    });

    socket.addEventListener("message", (evento) => {
      processarEventoWebSocket(evento.data);
    });

    socket.addEventListener("error", (erro) => {
      console.error("[WebSocket] Erro na conexão:", erro);
    });

    socket.addEventListener("close", () => {
      console.warn("[WebSocket] Conexão encerrada.");

      reconexaoAgendada = false;

      if (conexaoWebSocket === socket) {
        conexaoWebSocket = null;
      }

      iniciarFallback();
      agendarReconexao();
    });
  } catch (erro) {
    console.error("[WebSocket] Não foi possível conectar:", erro);

    reconexaoAgendada = false;

    iniciarFallback();
    agendarReconexao();
  }
}

// ======================================================
// PROCESSAR EVENTOS RECEBIDOS
// ======================================================

function processarEventoWebSocket(mensagem) {
  let dados;

  try {
    dados = JSON.parse(mensagem);
  } catch (erro) {
    console.error("[WebSocket] Mensagem inválida:", erro);
    return;
  }

  if (!dados || !dados.evento) return;

  switch (dados.evento) {
    case "conexao_estabelecida":
      console.log("[WebSocket] Autenticação confirmada.");
      break;

    case "pedido_atualizado":
    case "entrega_informada":
    case "notificacao_criada":
      atualizarAcompanhamento();
      break;

    default:
      console.log("[WebSocket] Evento recebido:", dados.evento);
      break;
  }
}

// ======================================================
// RECONEXÃO AUTOMÁTICA
// ======================================================

function agendarReconexao() {
  if (temporizadorReconexao) {
    clearTimeout(temporizadorReconexao);
  }

  if (document.visibilityState !== "visible") return;

  const atraso = intervaloReconexao;

  intervaloReconexao = Math.min(intervaloReconexao * 2, RECONEXAO_MAXIMA);

  temporizadorReconexao = setTimeout(() => {
    temporizadorReconexao = null;
    conectarWebSocket();
  }, atraso);
}

// ======================================================
// FALLBACK REST
// ======================================================

function iniciarFallback() {
  if (temporizadorFallback) return;

  console.warn(
    "[Acompanhamento] WebSocket desconectado. Ativando atualização de segurança.",
  );

  temporizadorFallback = setInterval(() => {
    if (!conexaoWebSocket || conexaoWebSocket.readyState !== WebSocket.OPEN) {
      atualizarAcompanhamento();
    }
  }, INTERVALO_FALLBACK);
}

function pararFallback() {
  if (temporizadorFallback) {
    clearInterval(temporizadorFallback);
    temporizadorFallback = null;
  }
}

// ======================================================
// VISIBILIDADE DA PÁGINA
// ======================================================

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    atualizarAcompanhamento();

    if (!conexaoWebSocket || conexaoWebSocket.readyState === WebSocket.CLOSED) {
      conectarWebSocket();
    }
  }
});

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

      if (data < new Date(`${inicio}T00:00:00`)) return false;
    }

    if (fim && dataPedido) {
      const data = new Date(dataPedido);

      if (data > new Date(`${fim}T23:59:59`)) return false;
    }

    return true;
  });

  const emptyState = document.getElementById("emptyState");

  if (!filtrados.length) {
    tabelaPedidos.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center;padding:24px">
          Nenhum pedido encontrado.
        </td>
      </tr>
    `;

    emptyState?.classList.remove("hidden");
    return;
  }

  emptyState?.classList.add("hidden");

  tabelaPedidos.innerHTML = filtrados
    .map((pedido) => {
      const confirmar = podeConfirmarRecebimento(pedido);

      return `
        <tr>
          <td>#${escaparHTML(pedido.id)}</td>
          <td>${escaparHTML(formatarData(obterDataPedido(pedido)))}</td>
          <td>${escaparHTML(statusTexto(pedido.status))}</td>
          <td>${escaparHTML(pedido.quantidade_itens ?? pedido.total_itens ?? "-")}</td>
          <td>${formatarMoeda(obterTotalPedido(pedido))}</td>
          <td>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button
                type="button"
                class="btn btn-secondary btn-ver-pedido"
                data-id="${escaparHTML(pedido.id)}"
              >
                Ver detalhes
              </button>

              ${
                confirmar
                  ? `
                    <button
                      type="button"
                      class="btn btn-primary btn-confirmar-entrega"
                      data-id="${escaparHTML(pedido.id)}"
                    >
                      Confirmar recebimento
                    </button>
                  `
                  : ""
              }
            </div>
          </td>
        </tr>
      `;
    })
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
                <span>${formatarMoeda(subtotal)}</span>
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
            ? `${statusTexto(statusAnterior)} → ${statusTexto(statusNovo)}`
            : `Pedido registrado: ${statusTexto(statusNovo)}`;

          return `
            <li>
              <strong>${escaparHTML(descricao)}</strong>
              <span>${escaparHTML(formatarData(item.data_alteracao))}</span>
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

    const pedido = dados.pedido || dados;

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

    const notificacaoEntrega = obterNotificacaoEntrega(pedido.id);

    pedidoModalBody.innerHTML = `
      <div class="pedido-detalhes">
        <h3>Pedido #${escaparHTML(pedido.id)}</h3>

        <p>
          <strong>Status:</strong>
          ${escaparHTML(statusTexto(pedido.status))}
        </p>

        ${
          notificacaoEntrega &&
          normalizarStatus(pedido.status) === "saiu_para_entrega"
            ? `
              <section>
                <h3>Confirmação de recebimento</h3>
                <p>
                  O entregador informou que seu pedido foi entregue.
                  Confirme abaixo se você realmente recebeu o pedido.
                </p>

                <button
                  type="button"
                  class="btn btn-primary btn-confirmar-entrega"
                  data-id="${escaparHTML(pedido.id)}"
                >
                  Confirmar recebimento
                </button>
              </section>
            `
            : ""
        }

        <p>
          <strong>Data:</strong>
          ${escaparHTML(formatarData(obterDataPedido(pedido)))}
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
    pedidoModal?.setAttribute("aria-hidden", "false");
  } catch (erro) {
    console.error("Erro ao abrir detalhes:", erro);
    mostrarMensagem(erro.message, "erro");
  }
}

// ======================================================
// CONFIRMAR RECEBIMENTO
// ======================================================

async function confirmarRecebimento(pedidoId) {
  const confirmado = window.confirm(
    `Você confirma que recebeu o pedido #${pedidoId}?`,
  );

  if (!confirmado) return;

  const botoes = document.querySelectorAll(
    `.btn-confirmar-entrega[data-id="${CSS.escape(String(pedidoId))}"]`,
  );

  botoes.forEach((botao) => {
    botao.disabled = true;
    botao.textContent = "Confirmando...";
  });

  try {
    await requisicao(
      `${API_NOTIFICACOES}/pedidos/${encodeURIComponent(pedidoId)}/confirmar-recebimento`,
      {
        method: "PATCH",
      },
    );

    mostrarMensagem(
      "Recebimento confirmado! Seu pedido foi concluído.",
      "sucesso",
    );

    await atualizarAcompanhamento();

    if (pedidoAtualId) {
      await abrirDetalhes(pedidoAtualId);
    }
  } catch (erro) {
    console.error("Erro ao confirmar recebimento:", erro);

    mostrarMensagem(
      `Não foi possível confirmar o recebimento: ${erro.message}`,
      "erro",
    );

    botoes.forEach((botao) => {
      botao.disabled = false;
      botao.textContent = "Confirmar recebimento";
    });
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

    const id = pedidoAtualId;

    if (id) {
      await abrirDetalhes(id);
    }
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
  pedidoModal?.setAttribute("aria-hidden", "true");

  if (pedidoModalCancelar) {
    pedidoModalCancelar.classList.add("hidden");
    pedidoModalCancelar.disabled = false;
  }
}

// ======================================================
// EVENTOS
// ======================================================

tabelaPedidos?.addEventListener("click", (evento) => {
  const botaoConfirmar = evento.target.closest(".btn-confirmar-entrega");

  if (botaoConfirmar) {
    confirmarRecebimento(botaoConfirmar.dataset.id);
    return;
  }

  const botaoDetalhes = evento.target.closest(".btn-ver-pedido");

  if (botaoDetalhes) {
    abrirDetalhes(botaoDetalhes.dataset.id);
  }
});

pedidoModalBody?.addEventListener("click", (evento) => {
  const botao = evento.target.closest(".btn-confirmar-entrega");

  if (!botao) return;

  confirmarRecebimento(botao.dataset.id);
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
// ABRIR PEDIDO INDICADO NA URL
// ======================================================

async function abrirPedidoDaNotificacao() {
  const parametros = new URLSearchParams(window.location.search);
  const pedidoId = parametros.get("pedido");

  if (!pedidoId || !/^\d+$/.test(pedidoId)) return;

  const pedidoExiste = pedidos.some(
    (pedido) => Number(pedido.id) === Number(pedidoId),
  );

  if (!pedidoExiste) {
    mostrarMensagem(
      "O pedido desta notificação não foi encontrado na sua conta.",
      "erro",
    );
    return;
  }

  await abrirDetalhes(pedidoId);

  // Remove o parâmetro da URL após tentar abrir o pedido.
  window.history.replaceState({}, document.title, window.location.pathname);
}

// ======================================================
// INICIALIZAÇÃO
// ======================================================

async function inicializar() {
  try {
    await carregarNotificacoes();
  } catch (erro) {
    console.error("Erro ao carregar notificações:", erro);
  }

  await carregarPedidos();

  // Abre o pedido correspondente quando a página vem do sino.
  await abrirPedidoDaNotificacao();

  conectarWebSocket();

  if (!conexaoWebSocket || conexaoWebSocket.readyState !== WebSocket.OPEN) {
    iniciarFallback();
  }
}

// ======================================================
// ENCERRAMENTO
// ======================================================

window.addEventListener("beforeunload", () => {
  pararFallback();

  if (temporizadorReconexao) {
    clearTimeout(temporizadorReconexao);
  }

  if (conexaoWebSocket) {
    conexaoWebSocket.close();
  }
});

/* =====================================================
   CENTRAL DE NOTIFICAÇÕES FRAGA LANCHES
   ===================================================== */

(function () {
  "use strict";

  if (window.fragaNotificacoesIniciado) return;
  window.fragaNotificacoesIniciado = true;

  function iniciarNotificacoes() {
    const cabecalho = document.querySelector(
      ".header-actions, .page-header-top",
    );

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

    if (cabecalho.classList.contains("page-header-top")) {
      const botaoCardapio = cabecalho.querySelector(
        'a[href="/cliente/cardapio.html"]',
      );

      if (botaoCardapio) {
        const grupoDireito = document.createElement("div");
        grupoDireito.className = "page-header-right";

        cabecalho.insertBefore(grupoDireito, botaoCardapio);

        grupoDireito.append(botaoCardapio, container);
      } else {
        cabecalho.appendChild(container);
      }
    } else {
      cabecalho.prepend(container);
    }

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

    async function abrirNotificacao(notificacao) {
      let destino = "/cliente/painel.html";

      if (notificacao.pedido_id) {
        destino =
          "/cliente/meus-pedidos.html?pedido=" +
          encodeURIComponent(notificacao.pedido_id);
      }

      if (!Number(notificacao.lida)) {
        try {
          await fetch(
            "/api/notificacoes/" + encodeURIComponent(notificacao.id) + "/lida",
            {
              method: "PATCH",
              credentials: "same-origin",
              headers: {
                Accept: "application/json",
              },
            },
          );
        } catch (erro) {
          console.error("[Notificações] Erro ao marcar como lida:", erro);
        }
      }

      window.location.href = destino;
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
        item.setAttribute("role", "button");
        item.setAttribute("tabindex", "0");

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

        item.addEventListener("click", function () {
          abrirNotificacao(notificacao);
        });

        item.addEventListener("keydown", function (evento) {
          if (evento.key === "Enter" || evento.key === " ") {
            evento.preventDefault();
            abrirNotificacao(notificacao);
          }
        });

        lista.appendChild(item);
      });
    }

    async function carregarNotificacoes() {
      try {
        const resposta = await fetch("/api/notificacoes", {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
          headers: {
            Accept: "application/json",
          },
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
          credentials: "same-origin",
        });

        if (resposta.ok) {
          await carregarNotificacoes();
        }
      } catch (erro) {
        console.error("[Notificações] Erro ao marcar todas:", erro);
      }
    });

    function conectarWebSocket() {
      const protocolo = location.protocol === "https:" ? "wss:" : "ws:";

      const ws = new WebSocket(protocolo + "//" + location.host + "/ws");

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
      const area = document.querySelector(".header-actions, .page-header-top");

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
      subtree: true,
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", aguardarCabecalho, {
      once: true,
    });
  } else {
    aguardarCabecalho();
  }
})();

// ======================================================
// EXECUÇÃO
// ======================================================

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", inicializar);
} else {
  inicializar();
}
