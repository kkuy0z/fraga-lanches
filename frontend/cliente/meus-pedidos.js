"use strict";

const API = "/api/pedidos";

const tbody = document.getElementById("tbodyPedidos");
const emptyState = document.getElementById("emptyState");
const tabelaPedidos = document.getElementById("tabelaPedidos");

const filtroStatus = document.getElementById("filtroStatus");
const dataInicio = document.getElementById("dataInicio");
const dataFim = document.getElementById("dataFim");
const btnLimparFiltros = document.getElementById("btnLimparFiltros");

const pedidoModal = document.getElementById("pedidoModal");
const pedidoModalBody = document.getElementById("pedidoModalBody");
const pedidoModalClose = document.getElementById("pedidoModalClose");
const pedidoModalFechar = document.getElementById("pedidoModalFechar");

let pedidos = [];
let requisicaoDetalhesAtual = 0;

const STATUS = {
  novo: "Novo",
  em_preparo: "Em preparo",
  pronto: "Pronto",
  saiu_para_entrega: "Saiu para entrega",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

const STATUS_CLASSES = {
  novo: "status-novo",
  em_preparo: "status-preparo",
  pronto: "status-pronto",
  saiu_para_entrega: "status-entrega",
  concluido: "status-concluido",
  cancelado: "status-cancelado",
};

function injetarEstilosStatus() {
  if (document.getElementById("fragaMeusPedidosStyles")) return;

  const style = document.createElement("style");
  style.id = "fragaMeusPedidosStyles";

  style.textContent = `
    .status-badge {
      display: inline-flex;
      align-items: center;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      border: 1px solid rgba(255, 255, 255, 0.14);
      background-color: rgba(255, 255, 255, 0.06);
      color: #f5f5f5;
      white-space: nowrap;
    }

    .status-badge.status-novo {
      border-color: rgba(245, 197, 66, 0.45);
      background-color: rgba(245, 197, 66, 0.14);
      color: #f5c542;
    }

    .status-badge.status-preparo {
      border-color: rgba(96, 165, 250, 0.45);
      background-color: rgba(96, 165, 250, 0.14);
      color: #93c5fd;
    }

    .status-badge.status-pronto {
      border-color: rgba(192, 132, 252, 0.45);
      background-color: rgba(192, 132, 252, 0.14);
      color: #d8b4fe;
    }

    .status-badge.status-entrega {
      border-color: rgba(251, 146, 60, 0.45);
      background-color: rgba(251, 146, 60, 0.14);
      color: #fdba74;
    }

    .status-badge.status-concluido {
      border-color: rgba(74, 222, 128, 0.45);
      background-color: rgba(74, 222, 128, 0.14);
      color: #86efac;
    }

    .status-badge.status-cancelado {
      border-color: rgba(248, 113, 113, 0.45);
      background-color: rgba(248, 113, 113, 0.14);
      color: #fca5a5;
    }

    .pedido-detalhes h3 {
      margin: 0 0 8px;
      color: #f5c542;
      font-family: "Anton", sans-serif;
      font-size: 18px;
      font-weight: 400;
      letter-spacing: 0.03em;
      text-transform: uppercase;
    }

    .pedido-detalhes p {
      margin: 4px 0;
      color: #e4e4e4;
    }

    .btn-detalhes {
      cursor: pointer;
    }
  `;

  document.head.appendChild(style);
}

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

function formatarData(data) {
  if (!data) return "—";

  const dataObj = new Date(data);

  if (Number.isNaN(dataObj.getTime())) {
    return "—";
  }

  return dataObj.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatarDataInput(data) {
  if (!data) return "";

  const dataObj = new Date(data);

  if (Number.isNaN(dataObj.getTime())) {
    return "";
  }

  const ano = dataObj.getFullYear();
  const mes = String(dataObj.getMonth() + 1).padStart(2, "0");
  const dia = String(dataObj.getDate()).padStart(2, "0");

  return `${ano}-${mes}-${dia}`;
}

function obterNomeStatus(status) {
  return STATUS[status] || status || "Desconhecido";
}

function obterClasseStatus(status) {
  return STATUS_CLASSES[status] || "";
}

function exibirMensagemTabela(mensagem) {
  if (!tbody) return;

  tbody.innerHTML = `
    <tr>
      <td colspan="6" style="text-align:center; padding:24px;">
        ${escaparHTML(mensagem)}
      </td>
    </tr>
  `;
}

async function requisicao(url) {
  const resposta = await fetch(url, {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });

  let dados;

  try {
    dados = await resposta.json();
  } catch {
    dados = {};
  }

  if (resposta.status === 401) {
    window.location.href = "/cadastro/login.html";
    throw new Error("Sua sessão expirou. Faça login novamente.");
  }

  if (!resposta.ok) {
    throw new Error(
      dados.mensagem ||
        dados.erro ||
        `Erro HTTP ${resposta.status}: não foi possível realizar a solicitação.`,
    );
  }

  return dados;
}

async function carregarPedidos() {
  injetarEstilosStatus();

  exibirMensagemTabela("Carregando pedidos...");

  emptyState?.classList.add("hidden");

  if (tabelaPedidos) {
    tabelaPedidos.style.display = "";
  }

  try {
    const dados = await requisicao(`${API}/meus`);

    pedidos = Array.isArray(dados)
      ? dados
      : Array.isArray(dados.pedidos)
        ? dados.pedidos
        : [];

    aplicarFiltros();
  } catch (erro) {
    console.error("Erro ao carregar pedidos:", erro);

    exibirMensagemTabela(erro.message);
  }
}

function aplicarFiltros() {
  const statusSelecionado = filtroStatus?.value || "";
  const inicio = dataInicio?.value || "";
  const fim = dataFim?.value || "";

  const filtrados = pedidos.filter((pedido) => {
    if (statusSelecionado && pedido.status !== statusSelecionado) {
      return false;
    }

    const dataPedido = formatarDataInput(pedido.data_pedido);

    if (inicio && dataPedido < inicio) {
      return false;
    }

    if (fim && dataPedido > fim) {
      return false;
    }

    return true;
  });

  renderizarPedidos(filtrados);
}

function renderizarPedidos(lista) {
  if (!tbody) return;

  tbody.innerHTML = "";

  if (!lista.length) {
    if (tabelaPedidos) {
      tabelaPedidos.style.display = "none";
    }

    emptyState?.classList.remove("hidden");
    return;
  }

  if (tabelaPedidos) {
    tabelaPedidos.style.display = "";
  }

  emptyState?.classList.add("hidden");

  lista.forEach((pedido) => {
    const linha = document.createElement("tr");

    const quantidadeItens = Number(
      pedido.quantidade_itens ?? pedido.total_itens ?? 0,
    );

    linha.innerHTML = `
      <td>
        <strong>#${escaparHTML(pedido.id)}</strong>
      </td>

      <td>
        ${escaparHTML(formatarData(pedido.data_pedido))}
      </td>

      <td>
        <span class="status-badge ${escaparHTML(obterClasseStatus(pedido.status))}">
          ${escaparHTML(obterNomeStatus(pedido.status))}
        </span>
      </td>

      <td>
        ${quantidadeItens}
      </td>

      <td>
        <strong>${formatarMoeda(pedido.total)}</strong>
      </td>

      <td>
        <button
          type="button"
          class="btn btn-secondary btn-detalhes"
          data-id="${escaparHTML(pedido.id)}">
          Ver detalhes
        </button>
      </td>
    `;

    tbody.appendChild(linha);
  });
}

async function abrirDetalhes(id) {
  if (!id || !pedidoModal || !pedidoModalBody) {
    console.error("Não foi possível abrir os detalhes: ID ou modal ausente.");
    return;
  }

  const requisicaoId = ++requisicaoDetalhesAtual;

  pedidoModal.classList.remove("hidden");
  pedidoModal.style.display = "flex";

  pedidoModal.setAttribute("aria-hidden", "false");

  pedidoModalBody.innerHTML = `
    <p style="text-align:center; padding:24px;">
      Carregando detalhes do pedido...
    </p>
  `;

  try {
    const dados = await requisicao(`${API}/${encodeURIComponent(id)}`);

    if (requisicaoId !== requisicaoDetalhesAtual) return;

    const pedido = dados.pedido || dados;
    const itens = Array.isArray(dados.itens) ? dados.itens : [];
    const historico = Array.isArray(dados.historico) ? dados.historico : [];

    renderizarDetalhes(pedido, itens, historico);
  } catch (erro) {
    if (requisicaoId !== requisicaoDetalhesAtual) return;

    console.error("Erro ao carregar detalhes:", erro);

    pedidoModalBody.innerHTML = `
      <p style="text-align:center; padding:24px;">
        ${escaparHTML(erro.message)}
      </p>
    `;
  }
}

function renderizarDetalhes(pedido, itens, historico) {
  const endereco = pedido.endereco;

  const htmlEndereco = endereco
    ? `
      <p>
        ${escaparHTML(endereco.rua)},
        ${escaparHTML(endereco.numero)}
      </p>

      <p>
        ${escaparHTML(endereco.bairro)} -
        ${escaparHTML(endereco.cidade)}
      </p>

      ${
        endereco.complemento
          ? `<p>Complemento: ${escaparHTML(endereco.complemento)}</p>`
          : ""
      }
    `
    : "<p>Retirada no estabelecimento</p>";

  const htmlItens = itens.length
    ? itens
        .map(
          (item) => `
            <div class="pedido-item"
              style="display:flex; justify-content:space-between; gap:16px; padding:12px 0; border-bottom:1px solid var(--border-color, #333);">

              <div>
                <strong>
                  ${Number(item.quantidade)}x
                  ${escaparHTML(item.nome_produto)}
                </strong>

                ${
                  item.personalizacao
                    ? `<p style="color:#a5a5a5; font-size:12px;">${escaparHTML(formatarPersonalizacao(item.personalizacao))}</p>`
                    : ""
                }
              </div>

              <strong>
                ${formatarMoeda(item.subtotal)}
              </strong>
            </div>
          `,
        )
        .join("")
    : "<p>Nenhum item encontrado.</p>";

  const htmlHistorico = historico.length
    ? historico
        .map(
          (registro) => `
            <div style="padding:10px 0; border-bottom:1px solid var(--border-color, #333);">
              <strong>
                ${escaparHTML(obterNomeStatus(registro.status_novo))}
              </strong>

              <p style="color:#a5a5a5; font-size:12px;">
                ${escaparHTML(formatarData(registro.data_alteracao))}
              </p>
            </div>
          `,
        )
        .join("")
    : "<p>Nenhuma atualização registrada.</p>";

  pedidoModalBody.innerHTML = `
    <div class="pedido-detalhes">

      <section style="margin-bottom:20px;">
        <h3>Pedido #${escaparHTML(pedido.id)}</h3>

        <p>
          Data: ${escaparHTML(formatarData(pedido.data_pedido))}
        </p>

        <p>
          Status:
          <strong>
            ${escaparHTML(obterNomeStatus(pedido.status))}
          </strong>
        </p>

        <p>
          Tipo:
          ${pedido.tipo_entrega === "entrega" ? "Entrega" : "Retirada"}
        </p>
      </section>

      <section style="margin-bottom:20px;">
        <h3>Itens do pedido</h3>
        ${htmlItens}
      </section>

      <section style="margin-bottom:20px;">
        <h3>Endereço</h3>
        ${htmlEndereco}
      </section>

      <section style="margin-bottom:20px;">
        <h3>Pagamento</h3>

        <p>
          Forma:
          ${escaparHTML(pedido.forma_pagamento || "Não informado")}
        </p>

        <p>
          Status:
          ${escaparHTML(pedido.status_pagamento || "Pendente")}
        </p>
      </section>

      <section style="margin-bottom:20px;">
        <h3>Resumo</h3>

        <p>Subtotal: ${formatarMoeda(pedido.subtotal)}</p>
        <p>Entrega: ${formatarMoeda(pedido.taxa_entrega)}</p>
        <p>Desconto: ${formatarMoeda(pedido.desconto)}</p>

        <h3>Total: ${formatarMoeda(pedido.total)}</h3>
      </section>

      ${
        pedido.observacoes
          ? `
            <section style="margin-bottom:20px;">
              <h3>Observações</h3>
              <p>${escaparHTML(pedido.observacoes)}</p>
            </section>
          `
          : ""
      }

      <section>
        <h3>Histórico do pedido</h3>
        ${htmlHistorico}
      </section>

    </div>
  `;
}

function formatarPersonalizacao(valor) {
  try {
    const dados = typeof valor === "string" ? JSON.parse(valor) : valor;

    if (!Array.isArray(dados)) {
      return "";
    }

    return dados
      .map((adicional) => adicional.nome)
      .filter(Boolean)
      .join(", ");
  } catch {
    return "";
  }
}

function fecharModal() {
  if (!pedidoModal) return;

  requisicaoDetalhesAtual++;

  pedidoModal.classList.add("hidden");
  pedidoModal.style.display = "none";
  pedidoModal.setAttribute("aria-hidden", "true");
}

function limparFiltros() {
  if (filtroStatus) filtroStatus.value = "";
  if (dataInicio) dataInicio.value = "";
  if (dataFim) dataFim.value = "";

  aplicarFiltros();
}

// Eventos dos filtros
filtroStatus?.addEventListener("change", aplicarFiltros);
dataInicio?.addEventListener("change", aplicarFiltros);
dataFim?.addEventListener("change", aplicarFiltros);

btnLimparFiltros?.addEventListener("click", limparFiltros);

// Evento delegado: funciona mesmo quando as linhas são recriadas.
tbody?.addEventListener("click", (event) => {
  const botao = event.target.closest(".btn-detalhes");

  if (!botao || !tbody.contains(botao)) return;

  event.preventDefault();

  abrirDetalhes(botao.dataset.id);
});

// Fechar modal
pedidoModalClose?.addEventListener("click", fecharModal);
pedidoModalFechar?.addEventListener("click", fecharModal);

pedidoModal?.addEventListener("click", (event) => {
  if (event.target === pedidoModal) {
    fecharModal();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    fecharModal();
  }
});

// Inicialização
carregarPedidos();
