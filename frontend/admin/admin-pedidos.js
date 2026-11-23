"use strict";

const API = "/api/admin/pedidos";
const API_AUTH = "/api/auth";
const API_ATRIBUICOES = "/api/admin/atribuicoes";

// ======================================================
// ELEMENTOS
// ======================================================

const tbody = document.getElementById("tbodyPedidos");
const buscaPedido = document.getElementById("buscaPedido");
const filtroStatus = document.getElementById("filtroStatus");
const filtroPagamento = document.getElementById("filtroPagamento");
const dataInicio = document.getElementById("dataInicio");
const dataFim = document.getElementById("dataFim");
const btnLimparFiltros = document.getElementById("btnLimparFiltros");

const emptyState = document.getElementById("emptyState");
const pagination = document.getElementById("pagination");

const pedidoModal = document.getElementById("pedidoModal");
const pedidoModalBody = document.getElementById("pedidoModalBody");
const pedidoModalTitulo = document.getElementById("pedidoModalTitulo");

const statusModal = document.getElementById("statusModal");
const statusForm = document.getElementById("statusForm");
const statusPedidoId = document.getElementById("statusPedidoId");
const novoStatus = document.getElementById("novoStatus");
const intencoesPixEmAprovacao = new Set();

let pedidos = [];
let intencoesPix = [];
let intervaloIntencoesPix = null;

// ======================================================
// CONSTANTES
// ======================================================

const STATUS = {
  novo: "Novo",
  em_preparo: "Em preparo",
  pronto: "Pronto",
  saiu_para_entrega: "Saiu para entrega",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

const FORMAS_PAGAMENTO = {
  pix: "PIX",
  cartao: "Cartão",
  credito: "Crédito",
  debito: "Débito",
  dinheiro: "Dinheiro",
  boleto: "Boleto",
  outro: "Outro",
};

const STATUS_PAGAMENTO = {
  pendente: "Pendente",
  aprovado: "Aprovado",
  recusado: "Recusado",
  cancelado: "Cancelado",
};

const TIPOS_CARTAO = {
  debito: "Débito",
  credito: "Crédito",
  vale_refeicao: "Vale-refeição",
};

const STATUS_CLASSES = {
  novo: "badge-warning",
  em_preparo: "badge-info",
  pronto: "badge-success",
  saiu_para_entrega: "badge-info",
  concluido: "badge-success",
  cancelado: "badge-danger",
};

const STATUS_PAGAMENTO_CLASSES = {
  pendente: "badge-warning",
  aprovado: "badge-success",
  recusado: "badge-danger",
  cancelado: "badge-secondary",
};

// ======================================================
// FUNÇÕES AUXILIARES
// ======================================================

function escaparHTML(valor) {
  return String(valor ?? "").replace(
    /[&<>"']/g,
    (caractere) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[caractere],
  );
}

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/**
 * Trata DATETIME do MySQL sem interpretar o horário como UTC.
 * Exemplo: 2026-11-20 14:30:00
 */
function formatarData(data) {
  if (!data) return "-";

  let dataObj;

  if (data instanceof Date) {
    dataObj = data;
  } else {
    const valor = String(data).trim();

    const mysqlMatch = valor.match(
      /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/,
    );

    if (mysqlMatch) {
      const [, ano, mes, dia, hora, minuto, segundo] = mysqlMatch;

      dataObj = new Date(
        Number(ano),
        Number(mes) - 1,
        Number(dia),
        Number(hora),
        Number(minuto),
        Number(segundo || 0),
      );
    } else {
      dataObj = new Date(valor);
    }
  }

  if (Number.isNaN(dataObj.getTime())) {
    return "-";
  }

  return dataObj.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function mostrarMensagem(mensagem) {
  alert(mensagem);
}

function obterStatus(status) {
  return STATUS[status] || status || "Desconhecido";
}

function obterClasseStatus(status) {
  return STATUS_CLASSES[status] || "badge-secondary";
}

function obterFormaPagamento(forma) {
  return FORMAS_PAGAMENTO[forma] || forma || "Não informado";
}

function obterStatusPagamento(status) {
  return STATUS_PAGAMENTO[status] || status || "Não registrado";
}

function obterClasseStatusPagamento(status) {
  return STATUS_PAGAMENTO_CLASSES[status] || "badge-secondary";
}

function obterTipoCartao(tipo) {
  return TIPOS_CARTAO[tipo] || tipo || "Não informado";
}

function abrirElementoModal(modal) {
  if (!modal) return;

  modal.classList.remove("hidden");
  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");
}

function fecharElementoModal(modal) {
  if (!modal) return;

  modal.classList.remove("show");
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
}

// ======================================================
// REQUISIÇÕES
// ======================================================

async function requisicao(url, opcoes = {}) {
  const resposta = await fetch(url, {
    credentials: "same-origin",
    ...opcoes,
    headers: {
      ...(opcoes.headers || {}),
      "Content-Type": "application/json",
    },
  });

  let dados = {};

  try {
    dados = await resposta.json();
  } catch {
    dados = {};
  }

  if (resposta.status === 401 || resposta.status === 403) {
    window.location.href = "/admin/admin-login.html";
    throw new Error("Sessão inválida ou sem permissão.");
  }

  if (!resposta.ok) {
    throw new Error(dados.mensagem || "Não foi possível concluir a operação.");
  }

  return dados;
}

// ======================================================
// AUTENTICAÇÃO
// ======================================================

async function carregarUsuario() {
  try {
    const dados = await requisicao(`${API_AUTH}/me`);
    const usuario = dados.usuario;

    if (!usuario || usuario.tipo !== "admin") {
      window.location.href = "/admin/admin-login.html";
      return false;
    }

    const nome = usuario.nome || "Administrador";

    const userName = document.getElementById("userName");
    const userAvatar = document.getElementById("userAvatar");
    const dropdownUserName = document.getElementById("dropdownUserName");

    if (userName) {
      userName.textContent = nome;
    }

    if (userAvatar) {
      userAvatar.textContent = nome.charAt(0).toUpperCase();
    }

    if (dropdownUserName) {
      dropdownUserName.textContent = nome;
    }

    return true;
  } catch (erro) {
    console.error("Erro ao carregar administrador:", erro);
    return false;
  }
}

// ======================================================
// MENU
// ======================================================

function configurarMenu() {
  const userButton = document.getElementById("userButton");
  const userDropdown = document.getElementById("userDropdown");
  const logoutBtn = document.getElementById("logoutBtn");

  if (userButton && userDropdown) {
    userButton.addEventListener("click", (evento) => {
      evento.stopPropagation();

      const aberto = userDropdown.classList.toggle("show");

      userButton.setAttribute("aria-expanded", String(aberto));
    });

    document.addEventListener("click", (evento) => {
      if (
        !userButton.contains(evento.target) &&
        !userDropdown.contains(evento.target)
      ) {
        userDropdown.classList.remove("show");
        userButton.setAttribute("aria-expanded", "false");
      }
    });
  }

  logoutBtn?.addEventListener("click", async () => {
    try {
      await requisicao(`${API_AUTH}/logout`, {
        method: "POST",
      });

      window.location.href = "/admin/admin-login.html";
    } catch (erro) {
      mostrarMensagem(erro.message);
    }
  });

  const navToggle = document.getElementById("adminNavToggle");
  const nav = document.getElementById("adminNav");

  navToggle?.addEventListener("click", () => {
    if (!nav) return;

    const aberto = nav.classList.toggle("show");

    navToggle.setAttribute("aria-expanded", String(aberto));
  });
}

// ======================================================
// CENTRAL DE INTENÇÕES PIX
// ======================================================

function criarPainelIntencoesPix() {
  let painel = document.getElementById("painelIntencoesPix");

  if (painel) return painel;

  const referencia =
    tbody?.closest(".table-container") ||
    tbody?.closest("table") ||
    tbody?.parentElement;

  if (!referencia) {
    console.error("Não foi possível localizar a tabela de pedidos.");
    return null;
  }

  painel = document.createElement("section");
  painel.id = "painelIntencoesPix";
  painel.style.cssText = `
    margin-bottom: 28px;
    padding: 20px;
    border: 1px solid var(--border-color, #ddd);
    border-radius: 12px;
    background: var(--card-bg, #fff);
  `;

  painel.innerHTML = `
    <div style="
      display:flex;
      justify-content:space-between;
      align-items:center;
      flex-wrap:wrap;
      gap:12px;
      margin-bottom:18px;
    ">
      <div>
        <h2 style="margin:0 0 5px;">PIX aguardando confirmação</h2>
        <p style="margin:0;opacity:.7;">
          Intenções que ainda não se transformaram em pedidos oficiais.
        </p>
      </div>

      <button
        type="button"
        class="btn btn-secondary btn-sm"
        id="btnAtualizarIntencoesPix"
      >
        Atualizar
      </button>
    </div>

    <div id="listaIntencoesPix">
      <p>Carregando intenções PIX...</p>
    </div>
  `;

  referencia.parentElement.insertBefore(painel, referencia);

  painel
    .querySelector("#btnAtualizarIntencoesPix")
    ?.addEventListener("click", carregarIntencoesPix);

  painel.addEventListener("click", async (evento) => {
    const alvo = evento.target;

    if (!(alvo instanceof Element)) return;

    const botao = alvo.closest('[data-acao="aprovar-intencao-pix"]');

    if (!botao || botao.disabled) return;

    const id = Number(botao.dataset.id);

    await aprovarIntencaoPix(id, botao);
  });

  return painel;
}

// ======================================================
// RENDERIZAR INTENÇÕES PIX
// ======================================================

function renderizarIntencoesPix() {
  const painel = criarPainelIntencoesPix();

  if (!painel) return;

  const lista = painel.querySelector("#listaIntencoesPix");

  if (!lista) return;

  if (!intencoesPix.length) {
    lista.innerHTML = `
      <div style="
        padding:20px;
        text-align:center;
        opacity:.7;
        border:1px dashed var(--border-color, #ccc);
        border-radius:8px;
      ">
        Nenhuma intenção PIX aguardando confirmação.
      </div>
    `;

    return;
  }

  lista.innerHTML = intencoesPix
    .map((intencao) => {
      const id = Number(intencao.id);

      const endereco = [
        intencao.rua,
        intencao.numero,
        intencao.bairro,
        intencao.cidade,
        intencao.complemento,
      ]
        .filter(Boolean)
        .join(", ");

      const itens = Array.isArray(intencao.itens) ? intencao.itens : [];

      return `
      <article style="
        border:1px solid var(--border-color, #ddd);
        border-radius:10px;
        padding:16px;
        margin-bottom:14px;
      ">
        <div style="
          display:flex;
          justify-content:space-between;
          align-items:flex-start;
          flex-wrap:wrap;
          gap:12px;
        ">
          <div>
            <strong style="font-size:17px;">
              PIX #${id}
            </strong>

            <p style="margin:5px 0;">
              ${escaparHTML(intencao.cliente_nome)}
            </p>

            <small style="opacity:.7;">
              Referência:
              ${escaparHTML(intencao.codigo_referencia)}
            </small>
          </div>

          <span class="badge badge-warning">
            Aguardando confirmação
          </span>
        </div>

        <hr style="margin:14px 0;opacity:.2;">

        <div style="
          display:grid;
          grid-template-columns:repeat(auto-fit,minmax(180px,1fr));
          gap:12px;
        ">
          <div>
            <small>Telefone</small>
            <p style="margin:4px 0;">
              ${escaparHTML(intencao.cliente_telefone || "-")}
            </p>
          </div>

          <div>
            <small>Entrega</small>
            <p style="margin:4px 0;">
              ${intencao.tipo_entrega === "entrega" ? "Entrega" : "Retirada"}
            </p>
          </div>

          <div>
            <small>Solicitado em</small>
            <p style="margin:4px 0;">
              ${escaparHTML(formatarData(intencao.criado_em))}
            </p>
          </div>

          <div>
            <small>Expira em</small>
            <p style="margin:4px 0;">
              ${escaparHTML(formatarData(intencao.expira_em))}
            </p>
          </div>
        </div>

        ${
          intencao.tipo_entrega === "entrega"
            ? `
          <div style="margin-top:12px;">
            <strong>Endereço:</strong>
            <p style="margin:4px 0;">
              ${escaparHTML(endereco || "Não informado")}
            </p>
          </div>
        `
            : ""
        }

        <hr style="margin:14px 0;opacity:.2;">

        <strong>Itens solicitados</strong>

        <div style="margin-top:10px;">
          ${itens
            .map(
              (item) => `
            <div style="
              display:flex;
              justify-content:space-between;
              gap:12px;
              padding:7px 0;
              border-bottom:1px solid var(--border-color, #eee);
            ">
              <div>
                <strong>
                  ${Number(item.quantidade)}x
                  ${escaparHTML(item.nome_produto)}
                </strong>

                ${
                  item.personalizacao
                    ? `
                  <p style="margin:3px 0;font-size:12px;opacity:.7;">
                    ${escaparHTML(item.personalizacao)}
                  </p>
                `
                    : ""
                }
              </div>

              <span>
                ${formatarMoeda(item.subtotal)}
              </span>
            </div>
          `,
            )
            .join("")}
        </div>

        <div style="margin-top:14px;">
          <p style="margin:5px 0;">
            Subtotal:
            <strong>${formatarMoeda(intencao.subtotal)}</strong>
          </p>

          <p style="margin:5px 0;">
            Entrega:
            <strong>${formatarMoeda(intencao.taxa_entrega)}</strong>
          </p>

          <p style="margin:5px 0;">
            Desconto:
            <strong>${formatarMoeda(intencao.desconto)}</strong>
          </p>

          <h3 style="margin:12px 0;">
            Total: ${formatarMoeda(intencao.total)}
          </h3>
        </div>

        ${
          intencao.observacoes
            ? `
          <div style="margin-top:10px;">
            <strong>Observações:</strong>
            <p>${escaparHTML(intencao.observacoes)}</p>
          </div>
        `
            : ""
        }

        <div style="margin-top:16px;">
          <button
            type="button"
            class="btn btn-success"
            data-acao="aprovar-intencao-pix"
            data-id="${id}"
          >
            Confirmar recebimento e criar pedido
          </button>
        </div>

        <p style="
          font-size:12px;
          opacity:.7;
          margin:10px 0 0;
        ">
          A aprovação exige conferência do crédito diretamente
          no extrato bancário. Uma imagem de comprovante não
          é confirmação suficiente.
        </p>
      </article>
    `;
    })
    .join("");
}

// ======================================================
// CARREGAR INTENÇÕES PIX
// ======================================================

async function carregarIntencoesPix() {
  const painel = criarPainelIntencoesPix();

  if (!painel) return;

  const lista = painel.querySelector("#listaIntencoesPix");

  try {
    const resultado = await requisicao(`${API}/pix/intencoes`);

    intencoesPix = Array.isArray(resultado)
      ? resultado
      : resultado.intencoes || [];

    renderizarIntencoesPix();
  } catch (erro) {
    console.error("Erro ao carregar intenções PIX:", erro);

    if (lista) {
      lista.innerHTML = `
        <p style="color:var(--danger-color,#c00);">
          ${escaparHTML(erro.message)}
        </p>
      `;
    }
  }
}

// ======================================================
// APROVAR INTENÇÃO PIX
// ======================================================

async function aprovarIntencaoPix(id, botao) {
  if (!Number.isInteger(id) || id <= 0) {
    mostrarMensagem("ID da intenção PIX inválido.");
    return;
  }

  // Impede aprovações simultâneas da mesma intenção.
  if (intencoesPixEmAprovacao.has(id)) {
    return;
  }

  const intencao = intencoesPix.find((item) => Number(item.id) === id);

  if (!intencao) {
    mostrarMensagem("Esta intenção PIX não está mais disponível.");
    return;
  }

  intencoesPixEmAprovacao.add(id);

  const textoOriginal = botao?.textContent;

  if (botao) {
    botao.disabled = true;
    botao.textContent = "Confirmando...";
  }

  try {
    const confirmado = window.confirm(
      `O valor de ${formatarMoeda(intencao.total)} foi ` +
        `conferido diretamente no extrato bancário?\n\n` +
        `Somente confirme se o crédito realmente entrou na conta.\n\n` +
        `Deseja aprovar o PIX e criar o pedido oficial?`,
    );

    if (!confirmado) {
      return;
    }

    const resultado = await requisicao(`${API}/pix/intencoes/${id}/aprovar`, {
      method: "POST",
    });

    const pedidoId = resultado?.pedido_id || resultado?.pedidoId;

    if (!pedidoId) {
      throw new Error(
        "A resposta não retornou o número do pedido. Atualize o painel e confira a situação da intenção.",
      );
    }

    if (resultado.ja_aprovada) {
      mostrarMensagem(
        `Esta intenção já havia sido aprovada.\nPedido oficial: #${pedidoId}`,
      );
    } else {
      mostrarMensagem(
        `${resultado.mensagem || "PIX confirmado com sucesso."}\n` +
          `Pedido oficial: #${pedidoId}`,
      );
    }

    // Atualiza a lista e os pedidos oficiais.
    await Promise.all([carregarIntencoesPix(), carregarPedidos()]);
  } catch (erro) {
    console.error("Erro ao aprovar intenção PIX:", erro);

    mostrarMensagem(erro.message || "Não foi possível aprovar a intenção PIX.");

    // Atualiza a situação real após uma falha.
    await carregarIntencoesPix();
  } finally {
    intencoesPixEmAprovacao.delete(id);

    if (botao && botao.isConnected) {
      botao.disabled = false;
      botao.textContent =
        textoOriginal || "Confirmar recebimento e criar pedido";
    }
  }
}

// ======================================================
// PEDIDOS
// ======================================================

async function carregarPedidos() {
  if (!tbody) return;

  tbody.innerHTML = `
    <tr>
      <td colspan="8" class="text-center py-4">
        Carregando pedidos...
      </td>
    </tr>
  `;

  emptyState?.classList.add("hidden");

  try {
    const parametros = new URLSearchParams();

    if (buscaPedido?.value.trim()) {
      parametros.set("busca", buscaPedido.value.trim());
    }

    if (filtroStatus?.value) {
      parametros.set("status", filtroStatus.value);
    }

    if (filtroPagamento?.value) {
      parametros.set("pagamento", filtroPagamento.value);
    }

    if (dataInicio?.value) {
      parametros.set("dataInicio", dataInicio.value);
    }

    if (dataFim?.value) {
      parametros.set("dataFim", dataFim.value);
    }

    if (
      dataInicio?.value &&
      dataFim?.value &&
      dataInicio.value > dataFim.value
    ) {
      throw new Error("A data inicial não pode ser posterior à data final.");
    }

    const query = parametros.toString();

    const resultado = await requisicao(query ? `${API}?${query}` : API);

    pedidos = Array.isArray(resultado) ? resultado : resultado.pedidos || [];

    renderizarPedidos();
  } catch (erro) {
    console.error("Erro ao carregar pedidos:", erro);

    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center py-4">
          ${escaparHTML(erro.message)}
        </td>
      </tr>
    `;

    emptyState?.classList.add("hidden");
  }
}

// ======================================================
// RENDERIZAÇÃO DA LISTAGEM
// ======================================================

function renderizarPedidos() {
  if (!tbody) return;

  if (pedidos.length === 0) {
    tbody.innerHTML = "";

    emptyState?.classList.remove("hidden");

    if (pagination) {
      pagination.style.display = "none";
    }

    return;
  }

  emptyState?.classList.add("hidden");

  tbody.innerHTML = pedidos
    .map((pedido) => {
      const id = Number(pedido.id);

      const formaPagamento = obterFormaPagamento(pedido.forma_pagamento);

      const statusPagamento = pedido.pagamento_status
        ? obterStatusPagamento(pedido.pagamento_status)
        : "Não informado";

      const classePagamento = pedido.pagamento_status
        ? obterClasseStatusPagamento(pedido.pagamento_status)
        : "badge-secondary";

      return `
        <tr>
          <td>
            <strong>#${id}</strong>
          </td>

          <td>
            ${escaparHTML(pedido.cliente_nome)}
          </td>

          <td>
            ${escaparHTML(formatarData(pedido.data_pedido))}
          </td>

          <td>
            ${pedido.tipo_entrega === "entrega" ? "Entrega" : "Retirada"}
          </td>

          <td>
            <span class="badge ${obterClasseStatus(pedido.status)}">
              ${escaparHTML(obterStatus(pedido.status))}
            </span>
          </td>

          <td>
            <div>
              <strong>
                ${escaparHTML(formaPagamento)}
              </strong>

              <br>

              <span class="badge ${classePagamento}">
                ${escaparHTML(statusPagamento)}
              </span>
            </div>
          </td>

          <td>
            <strong>
              ${formatarMoeda(pedido.total)}
            </strong>
          </td>

          <td>
            <div class="d-flex" style="gap: 8px; flex-wrap: wrap;">

              <button
                type="button"
                class="btn btn-secondary btn-sm"
                data-acao="detalhes"
                data-id="${id}"
              >
                Detalhes
              </button>

              ${
                ["concluido", "cancelado"].includes(pedido.status)
                  ? ""
                  : `
                    <button
                      type="button"
                      class="btn btn-primary btn-sm"
                      data-acao="status"
                      data-id="${id}"
                    >
                      Status
                    </button>
                  `
              }

            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  if (pagination) {
    pagination.style.display = "none";
  }
}

// ======================================================
// MODAL DE STATUS
// ======================================================

function abrirModalStatus(id) {
  const pedido = pedidos.find((item) => Number(item.id) === Number(id));

  if (!pedido || !statusModal || !statusForm) {
    mostrarMensagem("Não foi possível abrir o modal do pedido.");
    return;
  }

  statusForm.reset();

  statusPedidoId.value = pedido.id;
  novoStatus.value = pedido.status;

  abrirElementoModal(statusModal);
}

function fecharModalStatus() {
  if (!statusModal) return;

  fecharElementoModal(statusModal);
  statusForm?.reset();
}

async function alterarStatus(evento) {
  evento.preventDefault();

  const id = statusPedidoId.value;
  const status = novoStatus.value;

  if (!id || !status || !STATUS[status]) {
    mostrarMensagem("Selecione um status válido.");
    return;
  }

  const pedido = pedidos.find((item) => Number(item.id) === Number(id));

  if (!pedido) {
    mostrarMensagem("Pedido não encontrado.");
    return;
  }

  if (pedido.status === status) {
    mostrarMensagem("Selecione um status diferente do atual.");
    return;
  }

  const btn = document.getElementById("btnConfirmarStatus");

  if (btn) {
    btn.disabled = true;
    btn.textContent = "Salvando...";
  }

  try {
    const resultado = await requisicao(`${API}/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });

    fecharModalStatus();

    await carregarPedidos();

    mostrarMensagem(resultado.mensagem || "Status atualizado com sucesso!");
  } catch (erro) {
    console.error("Erro ao alterar status:", erro);
    mostrarMensagem(erro.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Alterar status";
    }
  }
}

// ======================================================
// MODAL DE DETALHES
// ======================================================

async function confirmarPagamento(id, botao) {
  if (!Number.isInteger(id) || id <= 0) {
    mostrarMensagem("ID do pedido invalido.");
    return;
  }

  const confirmado = window.confirm(
    "Confirme somente se o pagamento foi realmente recebido ou aprovado na maquininha. Deseja continuar?",
  );

  if (!confirmado) return;

  if (botao) botao.disabled = true;

  try {
    await requisicao(`${API}/${id}/pagamento`, {
      method: "PATCH",
    });

    mostrarMensagem("Recebimento do pagamento confirmado com sucesso.");

    try {
      await carregarPedidos();
    } catch (erroAtualizacao) {
      console.error("Erro ao atualizar a listagem:", erroAtualizacao);
    }

    await abrirDetalhes(id);
  } catch (erro) {
    mostrarMensagem(erro.message);

    if (botao) botao.disabled = false;
  }
}

async function abrirDetalhes(id) {
  if (!pedidoModal || !pedidoModalBody || !pedidoModalTitulo) {
    return;
  }

  try {
    pedidoModalBody.innerHTML = `
      <p>Carregando detalhes...</p>
    `;

    pedidoModalTitulo.textContent = `Pedido #${id}`;

    abrirElementoModal(pedidoModal);

    const dados = await requisicao(`${API}/${id}`);

    const pedido = dados.pedido;
    const itens = dados.itens || [];
    const pagamentos = dados.pagamentos || [];
    const historico = dados.historico || [];

    if (!pedido) {
      throw new Error("Pedido não encontrado.");
    }

    const endereco = pedido.endereco_id
      ? [
          pedido.rua,
          pedido.numero,
          pedido.bairro,
          pedido.cidade,
          pedido.complemento,
        ]
          .filter(Boolean)
          .join(", ")
      : "Retirada no estabelecimento";

    const pagamentoAtual = pagamentos[0] || null;

    const formasPresenciais = ["dinheiro", "cartao", "credito", "debito"];

    const podeConfirmarPagamento =
      ["pronto", "saiu_para_entrega"].includes(pedido.status) &&
      pagamentoAtual?.status === "pendente" &&
      formasPresenciais.includes(pagamentoAtual?.forma_pagamento);

    pedidoModalBody.innerHTML = `
      <div class="pedido-detalhes">

        <!-- CLIENTE -->

        <div class="form-row">

          <div class="form-group">
            <strong>Cliente</strong>
            <p>
              ${escaparHTML(pedido.cliente_nome)}
            </p>
          </div>

          <div class="form-group">
            <strong>Telefone</strong>
            <p>
              ${escaparHTML(pedido.cliente_telefone || "-")}
            </p>
          </div>

        </div>

        <div class="form-row">

          <div class="form-group">
            <strong>E-mail</strong>
            <p>
              ${escaparHTML(pedido.cliente_email || "-")}
            </p>
          </div>

          <div class="form-group">
            <strong>Data do pedido</strong>
            <p>
              ${escaparHTML(formatarData(pedido.data_pedido))}
            </p>
          </div>

        </div>

        <div class="form-group">
          <strong>Endereço / Entrega</strong>
          <p>
            ${escaparHTML(endereco)}
          </p>
        </div>

        <div class="form-group">
          <strong>Status do pedido</strong>
          <p>
            <span class="badge ${obterClasseStatus(pedido.status)}">
              ${escaparHTML(obterStatus(pedido.status))}
            </span>
          </p>
        </div>

        ${
          pedido.tipo_entrega === "entrega"
            ? `
              <hr>

              <h3>Entregador responsável</h3>

              <div
                id="areaAtribuicao"
                data-pedido-id="${Number(pedido.id)}"
                class="form-group"
              >
                Carregando informações da entrega...
              </div>
            `
            : ""
        }

        <hr>

        <!-- ITENS -->

        <h3>Itens do pedido</h3>

        ${
          itens.length
            ? `
              <div class="table-container">
                <table class="table">

                  <thead>
                    <tr>
                      <th>Produto</th>
                      <th>Quantidade</th>
                      <th>Preço</th>
                      <th>Subtotal</th>
                    </tr>
                  </thead>

                  <tbody>
                    ${itens
                      .map(
                        (item) => `
                          <tr>
                            <td>
                              <strong>
                                ${escaparHTML(item.nome_produto)}
                              </strong>

                              ${
                                item.personalizacao
                                  ? `<p>${escaparHTML(item.personalizacao)}</p>`
                                  : ""
                              }
                            </td>

                            <td>
                              ${Number(item.quantidade)}
                            </td>

                            <td>
                              ${formatarMoeda(item.preco_unitario)}
                            </td>

                            <td>
                              ${formatarMoeda(item.subtotal)}
                            </td>
                          </tr>
                        `,
                      )
                      .join("")}
                  </tbody>

                </table>
              </div>
            `
            : `
              <p>Nenhum item encontrado.</p>
            `
        }

        <hr>

        <!-- RESUMO FINANCEIRO -->

        <h3>Resumo financeiro</h3>

        <p>
          Subtotal:
          <strong>${formatarMoeda(pedido.subtotal)}</strong>
        </p>

        <p>
          Taxa de entrega:
          <strong>${formatarMoeda(pedido.taxa_entrega)}</strong>
        </p>

        <p>
          Desconto:
          <strong>${formatarMoeda(pedido.desconto)}</strong>
        </p>

        <h3>
          Total: ${formatarMoeda(pedido.total)}
        </h3>

        <hr>

        <!-- PAGAMENTO -->

        <h3>Pagamento</h3>

        ${
          pagamentoAtual
            ? `
              <div class="form-group">

                <p>
                  Forma de pagamento:
                  <strong>
                    ${escaparHTML(
                      obterFormaPagamento(pagamentoAtual.forma_pagamento),
                    )}
                  </strong>
                </p>

                ${
                  pagamentoAtual.tipo_cartao
                    ? `
                      <p>
                        Tipo de cartão:
                        <strong>
                          ${escaparHTML(
                            obterTipoCartao(pagamentoAtual.tipo_cartao),
                          )}
                        </strong>
                      </p>
                    `
                    : ""
                }

                <p>
                  Valor registrado:
                  <strong>
                    ${formatarMoeda(pagamentoAtual.valor)}
                  </strong>
                </p>

                <p>
                  Situação:

                  <span class="badge ${obterClasseStatusPagamento(pagamentoAtual.status)}">
                    ${escaparHTML(obterStatusPagamento(pagamentoAtual.status))}
                  </span>
                </p>

                <p>
                  Código da transação:
                  <strong>
                    ${escaparHTML(
                      pagamentoAtual.codigo_transacao || "Não informado",
                    )}
                  </strong>
                </p>

                <p>
                  Data do pagamento:
                  ${escaparHTML(formatarData(pagamentoAtual.data_pagamento))}
                </p>

              </div>

              ${
                pagamentos.length > 1
                  ? `
                    <h4>Registros anteriores</h4>

                    ${pagamentos
                      .slice(1)
                      .map(
                        (pagamento) => `
                          <div class="form-group">

                            <p>
                              ${escaparHTML(
                                obterFormaPagamento(pagamento.forma_pagamento),
                              )}
                              -
                              ${formatarMoeda(pagamento.valor)}
                            </p>

                            <p>
                              Status:
                              ${escaparHTML(
                                obterStatusPagamento(pagamento.status),
                              )}
                            </p>

                            <small>
                              ${escaparHTML(
                                formatarData(pagamento.data_pagamento),
                              )}
                            </small>

                          </div>
                        `,
                      )
                      .join("")}
                  `
                  : ""
              }
            `
            : `
              <div class="form-group">
                <p>
                  <strong>Forma de pagamento:</strong>
                  Não informado
                </p>

                <p>
                  <strong>Situação:</strong>
                  Nenhum pagamento registrado.
                </p>
              </div>
            `
        }

        <hr>

        <!-- OBSERVAÇÕES -->

        ${
          podeConfirmarPagamento
            ? `
          <div class="form-group">
            <button
              type="button"
              class="btn btn-success"
              data-acao="confirmar-pagamento"
              data-id="${Number(pedido.id)}"
            >
              Confirmar recebimento
            </button>

            <p>
              <small>
                Confirme somente depois de receber o valor ou verificar a aprovacao na maquininha.
              </small>
            </p>
          </div>
        `
            : ""
        }

<h3>Observações</h3>

        <p>
          ${escaparHTML(pedido.observacoes || "Nenhuma observação.")}
        </p>

        <hr>

        <!-- HISTÓRICO -->

        <h3>Histórico do pedido</h3>

        ${
          historico.length
            ? historico
                .map(
                  (item) => `
                    <div class="form-group">

                      <strong>
                        ${escaparHTML(obterStatus(item.status_novo))}
                      </strong>

                      <p>
                        ${escaparHTML(
                          item.status_anterior
                            ? obterStatus(item.status_anterior)
                            : "Criação do pedido",
                        )}

                        →

                        ${escaparHTML(obterStatus(item.status_novo))}
                      </p>

                      <small>
                        ${escaparHTML(item.usuario_nome || "Sistema")}
                        •
                        ${escaparHTML(formatarData(item.data_alteracao))}
                      </small>

                    </div>
                  `,
                )
                .join("")
            : `
              <p>Nenhuma alteração registrada.</p>
            `
        }

      </div>
    `;

    // Configura a atribuição depois de renderizar os detalhes.
    if (pedido.tipo_entrega === "entrega") {
      await configurarAtribuicao(pedido);
    }
  } catch (erro) {
    console.error("Erro ao carregar detalhes:", erro);

    pedidoModalBody.innerHTML = `
      <p>${escaparHTML(erro.message)}</p>
    `;
  }
}

function fecharModalDetalhes() {
  fecharElementoModal(pedidoModal);
}

// ======================================================
// ATRIBUIÇÃO DE ENTREGADORES
// ======================================================

async function configurarAtribuicao(pedido) {
  const area = document.getElementById("areaAtribuicao");

  if (!area) return;

  try {
    const resultadoEntrega = await requisicao(
      `${API_ATRIBUICOES}/${pedido.id}`,
    );

    const entrega = resultadoEntrega.entrega;

    let informacaoAtual = "";

    if (entrega && entrega.entregador_nome) {
      informacaoAtual = `
        <p>
          <strong>Entregador atual:</strong>
          ${escaparHTML(entrega.entregador_nome)}
        </p>

        <p>
          <strong>Situação da entrega:</strong>
          ${escaparHTML(entrega.status)}
        </p>
      `;
    } else {
      informacaoAtual = `
        <p>Nenhum entregador atribuído.</p>
      `;
    }

    if (pedido.status !== "pronto") {
      area.innerHTML = `
        ${informacaoAtual}

        <p>
          A atribuição fica disponível quando o pedido estiver
          com status <strong>Pronto</strong>.
        </p>
      `;

      return;
    }

    if (entrega && !["pendente", "atribuida"].includes(entrega.status)) {
      area.innerHTML = `
        ${informacaoAtual}

        <p>
          Esta entrega já foi iniciada ou finalizada.
          Não é possível alterar o entregador.
        </p>
      `;

      return;
    }

    const resultadoEntregadores = await requisicao(
      `${API_ATRIBUICOES}/entregadores`,
    );

    const entregadores = resultadoEntregadores.entregadores || [];

    if (!entregadores.length) {
      area.innerHTML = `
        ${informacaoAtual}

        <p>
          Não existem entregadores ativos cadastrados.
        </p>
      `;

      return;
    }

    const opcoes = entregadores
      .map((entregador) => {
        const selecionado =
          entrega && Number(entrega.entregador_id) === Number(entregador.id)
            ? "selected"
            : "";

        return `
          <option
            value="${Number(entregador.id)}"
            ${selecionado}
          >
            ${escaparHTML(entregador.nome)}
          </option>
        `;
      })
      .join("");

    area.innerHTML = `
      ${informacaoAtual}

      <label for="selectEntregador">
        Selecionar entregador
      </label>

      <select
        id="selectEntregador"
        class="form-control"
      >
        <option value="">Selecione um entregador</option>
        ${opcoes}
      </select>

      <button
        type="button"
        id="btnAtribuirEntregador"
        class="btn btn-primary"
        style="margin-top: 12px;"
      >
        ${entrega ? "Atualizar atribuição" : "Atribuir entrega"}
      </button>
    `;

    document
      .getElementById("btnAtribuirEntregador")
      ?.addEventListener("click", () => atribuirEntregador(pedido.id));
  } catch (erro) {
    console.error("Erro ao configurar atribuição:", erro);

    area.innerHTML = `
      <p>${escaparHTML(erro.message)}</p>
    `;
  }
}

async function atribuirEntregador(pedidoId) {
  const select = document.getElementById("selectEntregador");
  const botao = document.getElementById("btnAtribuirEntregador");

  const entregadorId = Number(select?.value);

  if (!entregadorId) {
    mostrarMensagem("Selecione um entregador.");
    return;
  }

  if (!confirm("Deseja atribuir este pedido ao entregador selecionado?")) {
    return;
  }

  if (botao) {
    botao.disabled = true;
    botao.textContent = "Atribuindo...";
  }

  try {
    const resultado = await requisicao(API_ATRIBUICOES, {
      method: "POST",
      body: JSON.stringify({
        pedidoId: Number(pedidoId),
        entregadorId,
      }),
    });

    mostrarMensagem(resultado.mensagem || "Entregador atribuído com sucesso!");

    await carregarPedidos();
    await abrirDetalhes(pedidoId);
  } catch (erro) {
    console.error("Erro ao atribuir entregador:", erro);
    mostrarMensagem(erro.message);

    if (botao) {
      botao.disabled = false;
      botao.textContent = "Atribuir entrega";
    }
  }
}

// ======================================================
// EVENTOS DA TABELA
// ======================================================

function configurarTabela() {
  if (!tbody) return;

  tbody.addEventListener("click", (evento) => {
    const botao = evento.target.closest("[data-acao]");

    if (!botao) return;

    const id = Number(botao.dataset.id);

    if (botao.dataset.acao === "detalhes") {
      abrirDetalhes(id);
    }

    if (botao.dataset.acao === "status") {
      abrirModalStatus(id);
    }
  });
}

// ======================================================
// EVENTOS DOS MODAIS
// ======================================================

function configurarModais() {
  pedidoModalBody?.addEventListener("click", async (evento) => {
    const botao = evento.target.closest('[data-acao="confirmar-pagamento"]');

    if (!botao) return;

    const id = Number(botao.dataset.id);

    await confirmarPagamento(id, botao);
  });

  statusForm?.addEventListener("submit", alterarStatus);

  document
    .getElementById("pedidoModalClose")
    ?.addEventListener("click", fecharModalDetalhes);

  document
    .getElementById("pedidoModalFechar")
    ?.addEventListener("click", fecharModalDetalhes);

  document
    .getElementById("btnCancelarStatus")
    ?.addEventListener("click", fecharModalStatus);

  document
    .getElementById("statusModalClose")
    ?.addEventListener("click", fecharModalStatus);

  pedidoModal?.addEventListener("click", (evento) => {
    if (evento.target === pedidoModal) {
      fecharModalDetalhes();
    }
  });

  statusModal?.addEventListener("click", (evento) => {
    if (evento.target === statusModal) {
      fecharModalStatus();
    }
  });

  document.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape") {
      fecharModalDetalhes();
      fecharModalStatus();
    }
  });
}

// ======================================================
// FILTROS
// ======================================================

function configurarFiltros() {
  let temporizadorBusca;

  buscaPedido?.addEventListener("input", () => {
    clearTimeout(temporizadorBusca);

    temporizadorBusca = setTimeout(() => {
      carregarPedidos();
    }, 350);
  });

  filtroStatus?.addEventListener("change", carregarPedidos);
  filtroPagamento?.addEventListener("change", carregarPedidos);
  dataInicio?.addEventListener("change", carregarPedidos);
  dataFim?.addEventListener("change", carregarPedidos);

  btnLimparFiltros?.addEventListener("click", () => {
    if (buscaPedido) buscaPedido.value = "";
    if (filtroStatus) filtroStatus.value = "";
    if (filtroPagamento) filtroPagamento.value = "";
    if (dataInicio) dataInicio.value = "";
    if (dataFim) dataFim.value = "";

    carregarPedidos();
  });
}

// ======================================================
// INICIALIZAÇÃO
// ======================================================

async function iniciar() {
  configurarMenu();
  configurarModais();
  configurarTabela();
  configurarFiltros();

  const autenticado = await carregarUsuario();

  if (!autenticado) {
    return;
  }

  await Promise.all([carregarPedidos(), carregarIntencoesPix()]);

  // Atualiza as intenções pendentes periodicamente.
  if (intervaloIntencoesPix) {
    clearInterval(intervaloIntencoesPix);
  }

  intervaloIntencoesPix = setInterval(() => {
    if (document.visibilityState === "visible") {
      carregarIntencoesPix();
    }
  }, 5000);

  console.log("[ADMIN PEDIDOS] Inicializado com sucesso.");
}

document.addEventListener("DOMContentLoaded", iniciar);

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

        item.style.cursor = "pointer";
        item.title = "Abrir pedido relacionado";
        // FRAGA_NOTIFICACAO_ABRE_PEDIDO
        item.addEventListener("click", async function () {
          try {
            if (!Number(notificacao.lida)) {
              const resposta = await fetch(
                "/api/notificacoes/" +
                  encodeURIComponent(notificacao.id) +
                  "/lida",
                { method: "PATCH", credentials: "same-origin" },
              );
              if (resposta.ok) await carregarNotificacoes();
            }
            const pedidoId = Number(notificacao.pedido_id);
            if (pedidoId > 0) await abrirDetalhes(pedidoId);
          } catch (erro) {
            console.error("[Notificações] Erro ao abrir pedido:", erro);
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
