"use strict";

// ======================================================
// CONFIGURAÇÕES
// ======================================================

const API = "/api/atendente/pedidos";
const API_AUTH = "/api/auth";
const API_ATRIBUICOES = "/api/admin/atribuicoes";

const INTERVALO_ATUALIZACAO = 5000;

const STATUS = {
  novo: "Novo",
  em_preparo: "Em preparo",
  pronto: "Pronto",
  saiu_para_entrega: "Saiu para entrega",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

// ======================================================
// ELEMENTOS
// ======================================================

const elementos = {
  nomeUsuario: document.getElementById("nome-usuario"),
  botaoSair: document.getElementById("btn-sair"),
  botaoAtualizar: document.getElementById("btn-atualizar"),

  pedidos: document.getElementById("pedidos"),
  notificacoes: document.getElementById("notificacoes"),

  busca: document.getElementById("busca-pedido"),
  filtroModalidade: document.getElementById("filtro-modalidade"),
  filtros: document.querySelectorAll("[data-filtro]"),

  detalhes: document.getElementById("detalhes-pedido"),
  conteudoDetalhes: document.getElementById("conteudo-detalhes"),

  conexao: document.getElementById("conexao-status"),

  resumo: {
    total: document.getElementById("total-pedidos"),
    novos: document.getElementById("total-novos"),
    preparo: document.getElementById("total-preparo"),
    prontos: document.getElementById("total-prontos"),
    entrega: document.getElementById("total-entrega"),
    concluidos: document.getElementById("total-concluidos"),
    cancelados: document.getElementById("total-cancelados"),
  },
};

// ======================================================
// ESTADO
// ======================================================

let pedidosAtuais = [];
let socket = null;
let intervaloAtualizacao = null;
let reconexaoSocket = null;
let tempoReconexao = 2000;
let usuarioAtual = null;
let filtroAtual = "todos";

const atribuicoesPorPedido = new Map();
const painéisAbertos = new Set();

// ======================================================
// ESTILOS DA ATRIBUIÇÃO
// ======================================================

function adicionarEstilosAtribuicao() {
  if (document.getElementById("estilos-atribuicao")) return;

  const estilo = document.createElement("style");

  estilo.id = "estilos-atribuicao";

  estilo.textContent = `
    .atribuicao-info {
      margin-top: 12px;
      padding: 10px;
      border-radius: 8px;
      background: rgba(255,255,255,0.06);
      font-size: 13px;
    }

    .atribuicao-info p {
      margin: 5px 0;
    }

    .atribuicao-painel {
      margin-top: 12px;
      padding: 14px;
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 10px;
      background: #222222;
      color: #ffffff;
    }

    .atribuicao-painel label {
      display: block;
      margin-bottom: 8px;
      color: #ffffff;
      font-size: 13px;
    }

    .atribuicao-painel select {
      display: block;
      width: 100%;
      padding: 11px;
      border-radius: 8px;
      margin-bottom: 8px;
      background-color: #1a1a1a !important;
      color: #ffffff !important;
      border: 1px solid #555555;
      font-size: 14px;
      appearance: auto;
    }

    .atribuicao-painel select option {
      background-color: #1a1a1a;
      color: #ffffff;
    }

    .atribuicao-painel button {
      width: 100%;
      margin-top: 8px;
      padding: 10px;
      cursor: pointer;
    }

    .atribuicao-mensagem {
      color: #ffffff;
      font-size: 13px;
      margin-top: 8px;
      opacity: 0.8;
    }
  `;

  document.head.appendChild(estilo);
}

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

function formatarData(valor) {
  if (!valor) return "Data não informada";

  const data = new Date(valor);

  if (Number.isNaN(data.getTime())) {
    return "Data não informada";
  }

  return data.toLocaleString("pt-BR");
}

function formatarStatus(status) {
  return STATUS[status] || status || "Não informado";
}

function adicionarNotificacao(mensagem) {
  const notificacao = document.createElement("p");

  notificacao.textContent = `${new Date().toLocaleTimeString("pt-BR")} - ${mensagem}`;

  const vazio = elementos.notificacoes.querySelector(".mensagem-vazia");

  if (vazio) {
    elementos.notificacoes.innerHTML = "";
  }

  elementos.notificacoes.prepend(notificacao);

  while (elementos.notificacoes.children.length > 10) {
    elementos.notificacoes.lastElementChild.remove();
  }
}

async function requisicao(url, opcoes = {}) {
  const resposta = await fetch(url, {
    credentials: "same-origin",
    ...opcoes,
    headers: {
      ...(opcoes.headers || {}),
    },
  });

  if (resposta.status === 401) {
    window.location.href = "/cadastro/login.html";
    throw new Error("Sessão expirada.");
  }

  const dados = await resposta.json().catch(() => ({}));

  if (!resposta.ok) {
    throw new Error(dados.mensagem || "Erro ao consultar o servidor.");
  }

  return dados;
}

// ======================================================
// AUTENTICAÇÃO
// ======================================================

async function verificarAcesso() {
  try {
    const dados = await requisicao(`${API_AUTH}/me`);

    usuarioAtual = dados.usuario;

    if (!["atendente", "admin"].includes(usuarioAtual.tipo)) {
      document.body.innerHTML = "<h2>Acesso não autorizado.</h2>";
      return false;
    }

    elementos.nomeUsuario.textContent = usuarioAtual.nome || "Usuário";

    return true;
  } catch (erro) {
    console.error("Erro ao verificar acesso:", erro);
    return false;
  }
}

// ======================================================
// RESUMO
// ======================================================

async function carregarResumo() {
  try {
    const dados = await requisicao(`${API}/resumo`);

    document.getElementById("total-aguardando").textContent = dados.novos ?? 0;

    document.getElementById("total-preparo").textContent = dados.emPreparo ?? 0;

    document.getElementById("total-prontos").textContent =
      Number(dados.prontos || 0) + Number(dados.saiuParaEntrega || 0);

    document.getElementById("total-concluidos").textContent =
      dados.concluidos ?? 0;
  } catch (erro) {
    console.error("Erro ao carregar resumo:", erro);
  }
}

// ======================================================
// CONSULTAR ATRIBUIÇÕES DOS PEDIDOS
// ======================================================

async function carregarAtribuicoes() {
  const pedidosElegiveis = pedidosAtuais.filter(
    (pedido) => pedido.status === "pronto" && pedido.tipo_entrega === "entrega",
  );

  const consultas = pedidosElegiveis.map(async (pedido) => {
    try {
      const dados = await requisicao(`${API_ATRIBUICOES}/${pedido.id}`);

      atribuicoesPorPedido.set(Number(pedido.id), dados.entrega || null);
    } catch (erro) {
      console.error(
        `Erro ao consultar atribuição do pedido ${pedido.id}:`,
        erro,
      );
    }
  });

  await Promise.all(consultas);
}

// ======================================================
// LISTAR PEDIDOS
// ======================================================

async function carregarPedidos() {
  try {
    const parametros = new URLSearchParams();

    const busca = elementos.busca.value.trim();

    if (busca) {
      parametros.set("busca", busca);
    }

    const sufixo = parametros.toString() ? `?${parametros.toString()}` : "";

    const dados = await requisicao(`${API}/${sufixo}`);

    if (!Array.isArray(dados)) {
      throw new Error("Formato de resposta dos pedidos inválido.");
    }

    pedidosAtuais = dados;

    await carregarAtribuicoes();

    renderizarPedidos();
  } catch (erro) {
    console.error("Erro ao carregar pedidos:", erro);

    elementos.pedidos.innerHTML = `
      <p class="mensagem-vazia">
        ${escaparHTML(erro.message)}
      </p>
    `;
  }
}

// ======================================================
// RENDERIZAR INFORMAÇÕES DA ATRIBUIÇÃO
// ======================================================

function renderizarInformacaoAtribuicao(pedido) {
  const entrega = atribuicoesPorPedido.get(Number(pedido.id));

  if (!entrega) {
    return `
      <div class="atribuicao-info">
        <p><strong>Entregador:</strong> Ainda não atribuído.</p>
      </div>
    `;
  }

  return `
    <div class="atribuicao-info">
      <p>
        <strong>Entregador:</strong>
        ${escaparHTML(entrega.entregador_nome || "Não informado")}
      </p>

      <p>
        <strong>Status da entrega:</strong>
        ${escaparHTML(entrega.status || "Não informado")}
      </p>
    </div>
  `;
}

// ======================================================
// RENDERIZAR PEDIDOS
// ======================================================

// ======================================================
// RENDERIZAR PEDIDOS EM TABELA
// ======================================================

function renderizarPedidos() {
  let pedidosFiltrados = [...pedidosAtuais];

  const modalidade = elementos.filtroModalidade.value;

  if (modalidade) {
    pedidosFiltrados = pedidosFiltrados.filter(
      (pedido) => pedido.tipo_entrega === modalidade,
    );
  }

  const mapaStatus = {
    todos: null,
    novo: "novo",
    em_preparo: "em_preparo",
    pronto: "pronto",
    saiu_entrega: "saiu_para_entrega",
    entregue: "concluido",
  };

  const statusSelecionado = mapaStatus[filtroAtual];

  if (statusSelecionado) {
    pedidosFiltrados = pedidosFiltrados.filter(
      (pedido) => pedido.status === statusSelecionado,
    );
  }

  if (!pedidosFiltrados.length) {
    elementos.pedidos.innerHTML = `
      <div class="tabela-vazia">
        <span class="tabela-vazia-icone">📋</span>
        <strong>Nenhum pedido encontrado</strong>
        <p>Não existem pedidos correspondentes aos filtros selecionados.</p>
      </div>
    `;
    return;
  }

  elementos.pedidos.innerHTML = `
    <div class="tabela-pedidos-wrapper">
      <table class="tabela-pedidos">
        <thead>
          <tr>
            <th>Pedido</th>
            <th>Cliente</th>
            <th>Data</th>
            <th>Itens</th>
            <th>Modalidade</th>
            <th>Pagamento</th>
            <th>Total</th>
            <th>Ações</th>
          </tr>
        </thead>

        <tbody>
          ${pedidosFiltrados
            .map((pedido) => {
              const permiteAtribuicao =
                pedido.status === "pronto" && pedido.tipo_entrega === "entrega";

              const entrega = atribuicoesPorPedido.get(Number(pedido.id));

              const botaoAtribuicao = permiteAtribuicao
                ? `
                  <button
                    type="button"
                    class="tabela-btn tabela-btn-entregador"
                    data-atribuir-pedido="${escaparHTML(pedido.id)}"
                  >
                    ${entrega ? "Alterar entregador" : "Atribuir entregador"}
                  </button>

                  ${renderizarInformacaoAtribuicao(pedido)}

                  <div
                    class="atribuicao-painel"
                    data-painel-atribuicao="${escaparHTML(pedido.id)}"
                    hidden
                  ></div>
                `
                : "";

              return `
                <tr>
                  <td>
                    <div class="tabela-pedido-identificacao">
                      <strong>#${escaparHTML(pedido.id)}</strong>
                      <span class="pedido-status status-${escaparHTML(pedido.status)}">
                        ${escaparHTML(formatarStatus(pedido.status))}
                      </span>
                    </div>
                  </td>

                  <td>
                    <span class="tabela-cliente">
                      ${escaparHTML(pedido.cliente_nome || "Cliente não informado")}
                    </span>
                  </td>

                  <td>
                    <span class="tabela-data">
                      ${escaparHTML(formatarData(pedido.data_pedido))}
                    </span>
                  </td>

                  <td>
                    <span class="tabela-quantidade">
                      ${escaparHTML(pedido.quantidade_itens ?? 0)}
                    </span>
                  </td>

                  <td>
                    <span class="tabela-modalidade">
                      ${pedido.tipo_entrega === "entrega" ? "Entrega" : "Retirada"}
                    </span>
                  </td>

                  <td>
                    <span class="tabela-pagamento">
                      ${escaparHTML(pedido.forma_pagamento || "Não informado")}
                    </span>
                  </td>

                  <td>
                    <strong class="tabela-total">
                      ${formatarMoeda(pedido.total)}
                    </strong>
                  </td>

                  <td>
                    <div class="tabela-acoes">
                      <button
                        type="button"
                        class="tabela-btn tabela-btn-detalhes"
                        data-pedido-id="${escaparHTML(pedido.id)}"
                      >
                        Detalhes
                      </button>

                      ${botaoAtribuicao}
                    </div>
                  </td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
    </div>

    <div class="tabela-rodape">
      <span>
        Exibindo <strong>${pedidosFiltrados.length}</strong>
        ${pedidosFiltrados.length === 1 ? "pedido" : "pedidos"}
      </span>
    </div>
  `;
}

// ======================================================
// ABRIR PAINEL DE ATRIBUIÇÃO
// ======================================================

async function abrirPainelAtribuicao(pedidoId) {
  const painel = elementos.pedidos.querySelector(
    `[data-painel-atribuicao="${pedidoId}"]`,
  );

  if (!painel) return;

  if (!painel.hidden) {
    painel.hidden = true;
    painéisAbertos.delete(pedidoId);
    return;
  }

  painel.hidden = false;
  painéisAbertos.add(pedidoId);

  painel.innerHTML = `
    <p class="atribuicao-mensagem">
      Carregando entregadores...
    </p>
  `;

  try {
    const [dadosEntregadores, dadosAtribuicao] = await Promise.all([
      requisicao(`${API_ATRIBUICOES}/entregadores`),
      requisicao(`${API_ATRIBUICOES}/${pedidoId}`),
    ]);

    const entregadores = dadosEntregadores.entregadores || [];
    const entrega = dadosAtribuicao.entrega || null;

    atribuicoesPorPedido.set(pedidoId, entrega);

    if (!painel.isConnected || painel.hidden) return;

    if (!entregadores.length) {
      painel.innerHTML = `
        <p class="atribuicao-mensagem">
          Nenhum entregador ativo foi encontrado.
        </p>
      `;
      return;
    }

    const opcoes = entregadores
      .map(
        (entregador) => `
          <option
            value="${escaparHTML(entregador.id)}"
            ${
              entrega && Number(entrega.entregador_id) === Number(entregador.id)
                ? "selected"
                : ""
            }
          >
            ${escaparHTML(entregador.nome)}
            ${
              entregador.telefone
                ? ` - ${escaparHTML(entregador.telefone)}`
                : ""
            }
          </option>
        `,
      )
      .join("");

    painel.innerHTML = `
      <label for="entregador-${pedidoId}">
        <strong>Selecionar entregador</strong>
      </label>

      <select id="entregador-${pedidoId}">
        <option value="">Selecione um entregador</option>
        ${opcoes}
      </select>

      <button
        type="button"
        data-salvar-atribuicao="${pedidoId}"
      >
        Confirmar atribuição
      </button>

      <p
        class="atribuicao-mensagem"
        data-mensagem-atribuicao="${pedidoId}"
      ></p>
    `;
  } catch (erro) {
    console.error("Erro ao abrir atribuição:", erro);

    painel.innerHTML = `
      <p class="atribuicao-mensagem">
        ${escaparHTML(erro.message)}
      </p>
    `;
  }
}

// ======================================================
// SALVAR ATRIBUIÇÃO
// ======================================================

async function salvarAtribuicao(pedidoId, botao) {
  const seletor = document.getElementById(`entregador-${pedidoId}`);

  const mensagem = elementos.pedidos.querySelector(
    `[data-mensagem-atribuicao="${pedidoId}"]`,
  );

  if (!seletor) return;

  const entregadorId = Number(seletor.value);

  if (!entregadorId) {
    if (mensagem) {
      mensagem.textContent = "Selecione um entregador.";
    }
    return;
  }

  const entregadorNome = seletor.options[seletor.selectedIndex].text.trim();

  const confirmar = window.confirm(
    `Deseja atribuir o pedido #${pedidoId} ao entregador ${entregadorNome}?`,
  );

  if (!confirmar) return;

  try {
    botao.disabled = true;
    botao.textContent = "Salvando...";

    const dados = await requisicao(API_ATRIBUICOES, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        pedidoId,
        entregadorId,
      }),
    });

    adicionarNotificacao(
      `Entregador ${dados.entregador.nome} atribuído ao pedido #${pedidoId}.`,
    );

    atribuicoesPorPedido.set(pedidoId, {
      pedido_id: pedidoId,
      entregador_id: entregadorId,
      entregador_nome: dados.entregador.nome,
      status: "atribuida",
    });

    await carregarPedidos();
  } catch (erro) {
    console.error("Erro ao atribuir entregador:", erro);

    if (mensagem) {
      mensagem.textContent = erro.message;
    }

    botao.disabled = false;
    botao.textContent = "Confirmar atribuição";
  }
}

// ======================================================
// DETALHES DO PEDIDO
// ======================================================

async function visualizarPedido(pedidoId) {
  try {
    const dados = await requisicao(`${API}/${pedidoId}`);

    const pedido = dados.pedido;

    const endereco =
      pedido.tipo_entrega === "entrega"
        ? `
          <p>
            <strong>Endereço:</strong>
            ${escaparHTML(pedido.rua)},
            ${escaparHTML(pedido.numero)}
          </p>

          <p>
            <strong>Bairro:</strong>
            ${escaparHTML(pedido.bairro)}
          </p>

          <p>
            <strong>Cidade:</strong>
            ${escaparHTML(pedido.cidade)}
          </p>

          <p>
            <strong>Complemento:</strong>
            ${escaparHTML(pedido.complemento || "Não informado")}
          </p>
        `
        : "<p>Pedido para retirada no estabelecimento.</p>";

    const itensHTML = dados.itens
      .map((item) => {
        let adicionais = [];

        try {
          adicionais = item.personalizacao
            ? JSON.parse(item.personalizacao)
            : [];
        } catch {
          adicionais = [];
        }

        const adicionaisHTML = Array.isArray(adicionais)
          ? adicionais
              .map(
                (adicional) => `
                  <li>
                    ${escaparHTML(adicional.nome)}
                    - ${formatarMoeda(adicional.preco)}
                  </li>
                `,
              )
              .join("")
          : "";

        return `
          <li>
            <strong>
              ${escaparHTML(item.quantidade)}x
              ${escaparHTML(item.nome_produto)}
            </strong>

            <p>
              Unitário: ${formatarMoeda(item.preco_unitario)}
            </p>

            <p>
              Subtotal: ${formatarMoeda(item.subtotal)}
            </p>

            ${adicionaisHTML ? `<ul>${adicionaisHTML}</ul>` : ""}
          </li>
        `;
      })
      .join("");

    const historicoHTML = dados.historico
      .map(
        (item) => `
          <li>
            ${escaparHTML(formatarStatus(item.status_anterior || "Inicial"))}
            →
            ${escaparHTML(formatarStatus(item.status_novo))}

            <p>
              ${escaparHTML(formatarData(item.data_alteracao))}
            </p>

            <p>
              Responsável:
              ${escaparHTML(item.responsavel || "Sistema")}
            </p>
          </li>
        `,
      )
      .join("");

    elementos.conteudoDetalhes.innerHTML = `
      <h3>Pedido #${escaparHTML(pedido.id)}</h3>

      <p>
        <strong>Status:</strong>
        ${escaparHTML(formatarStatus(pedido.status))}
      </p>

      <p>
        <strong>Cliente:</strong>
        ${escaparHTML(pedido.cliente_nome)}
      </p>

      <p>
        <strong>E-mail:</strong>
        ${escaparHTML(pedido.cliente_email)}
      </p>

      <p>
        <strong>Telefone:</strong>
        ${escaparHTML(pedido.cliente_telefone || "Não informado")}
      </p>

      <p>
        <strong>Data:</strong>
        ${escaparHTML(formatarData(pedido.data_pedido))}
      </p>

      ${endereco}

      <h4>Itens do pedido</h4>

      <ul>
        ${itensHTML || "<li>Nenhum item encontrado.</li>"}
      </ul>

      <h4>Pagamento</h4>

      <p>
        <strong>Forma:</strong>
        ${escaparHTML(pedido.forma_pagamento || "Não informado")}
      </p>

      <p>
        <strong>Status:</strong>
        ${escaparHTML(pedido.status_pagamento || "Não informado")}
      </p>

      <p>
        <strong>Subtotal:</strong>
        ${formatarMoeda(pedido.subtotal)}
      </p>

      <p>
        <strong>Taxa de entrega:</strong>
        ${formatarMoeda(pedido.taxa_entrega)}
      </p>

      <p>
        <strong>Desconto:</strong>
        ${formatarMoeda(pedido.desconto)}
      </p>

      <p>
        <strong>Total:</strong>
        ${formatarMoeda(pedido.total)}
      </p>

      <p>
        <strong>Observações:</strong>
        ${escaparHTML(pedido.observacoes || "Nenhuma")}
      </p>

      <h4>Histórico</h4>

      <ul>
        ${historicoHTML || "<li>Sem histórico disponível.</li>"}
      </ul>

      <button type="button" id="btn-fechar-detalhes">
        Fechar detalhes
      </button>
    `;

    elementos.detalhes.hidden = false;

    elementos.detalhes.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });

    document
      .getElementById("btn-fechar-detalhes")
      .addEventListener("click", () => {
        elementos.detalhes.hidden = true;
      });
  } catch (erro) {
    console.error("Erro ao consultar detalhes:", erro);
    adicionarNotificacao(erro.message);
  }
}

// ======================================================
// WEBSOCKET
// ======================================================

function conectarWebSocket() {
  if (
    socket &&
    (socket.readyState === WebSocket.OPEN ||
      socket.readyState === WebSocket.CONNECTING)
  ) {
    return;
  }

  const protocolo = location.protocol === "https:" ? "wss:" : "ws:";

  socket = new WebSocket(`${protocolo}//${location.host}/ws`);

  socket.addEventListener("open", () => {
    elementos.conexao.textContent = "Conectado em tempo real.";

    tempoReconexao = 2000;

    atualizarPainel();
  });

  socket.addEventListener("message", (evento) => {
    try {
      const dados = JSON.parse(evento.data);

      if (
        [
          "novo_pedido",
          "pedido_atualizado",
          "entrega_informada",
          "entrega_atribuida",
        ].includes(dados.evento)
      ) {
        adicionarNotificacao(
          dados.mensagem || "Um pedido ou uma entrega foi atualizado.",
        );

        atualizarPainel();
      }
    } catch (erro) {
      console.error("Erro ao processar evento WebSocket:", erro);
    }
  });

  socket.addEventListener("close", () => {
    elementos.conexao.textContent =
      "Sem conexão em tempo real. Tentando reconectar...";

    agendarReconexao();
  });

  socket.addEventListener("error", (erro) => {
    console.error("Erro no WebSocket:", erro);

    elementos.conexao.textContent = "Erro na conexão em tempo real.";
  });
}

function agendarReconexao() {
  if (reconexaoSocket) return;

  reconexaoSocket = setTimeout(() => {
    reconexaoSocket = null;

    conectarWebSocket();

    tempoReconexao = Math.min(tempoReconexao * 2, 30000);
  }, tempoReconexao);
}

// ======================================================
// ATUALIZAÇÃO GERAL
// ======================================================

async function atualizarPainel() {
  await Promise.all([carregarPedidos(), carregarResumo()]);
}

// ======================================================
// EVENTOS
// ======================================================

elementos.botaoAtualizar.addEventListener("click", atualizarPainel);

elementos.filtros.forEach((botao) => {
  botao.addEventListener("click", () => {
    filtroAtual = botao.dataset.filtro;

    elementos.filtros.forEach((item) => {
      item.classList.toggle("filtro-ativo", item === botao);
    });

    renderizarPedidos();
  });
});

elementos.filtroModalidade.addEventListener("change", renderizarPedidos);

let temporizadorBusca = null;

elementos.busca.addEventListener("input", () => {
  clearTimeout(temporizadorBusca);

  temporizadorBusca = setTimeout(carregarPedidos, 350);
});

elementos.pedidos.addEventListener("click", (evento) => {
  const botaoAtribuir = evento.target.closest("[data-atribuir-pedido]");

  if (botaoAtribuir) {
    const pedidoId = Number(botaoAtribuir.dataset.atribuirPedido);

    abrirPainelAtribuicao(pedidoId);
    return;
  }

  const botaoSalvar = evento.target.closest("[data-salvar-atribuicao]");

  if (botaoSalvar) {
    const pedidoId = Number(botaoSalvar.dataset.salvarAtribuicao);

    salvarAtribuicao(pedidoId, botaoSalvar);
    return;
  }

  const botaoDetalhes = evento.target.closest("[data-pedido-id]");

  if (botaoDetalhes) {
    visualizarPedido(Number(botaoDetalhes.dataset.pedidoId));
  }
});

elementos.botaoSair.addEventListener("click", async () => {
  try {
    await fetch(`${API_AUTH}/logout`, {
      method: "POST",
      credentials: "same-origin",
    });
  } catch (erro) {
    console.error("Erro ao sair:", erro);
  } finally {
    if (socket) {
      socket.close();
    }

    if (intervaloAtualizacao) {
      clearInterval(intervaloAtualizacao);
    }

    window.location.href = "/cadastro/login.html";
  }
});

// ======================================================
// INICIALIZAÇÃO
// ======================================================

async function iniciarPainel() {
  adicionarEstilosAtribuicao();

  const autorizado = await verificarAcesso();

  if (!autorizado) return;

  await atualizarPainel();

  conectarWebSocket();

  intervaloAtualizacao = setInterval(() => {
    atualizarPainel();
  }, INTERVALO_ATUALIZACAO);
}

iniciarPainel();

/* =====================================================
   CENTRAL DE NOTIFICAÇÕES FRAGA LANCHES
   ===================================================== */
(function () {
  "use strict";

  if (window.fragaNotificacoesIniciado) return;
  window.fragaNotificacoesIniciado = true;

  function iniciarNotificacoes() {
    const cabecalho = document.querySelector("header > div");

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
            if (pedidoId > 0) await visualizarPedido(pedidoId);
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
      const area = document.querySelector("header > div");

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
