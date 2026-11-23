"use strict";

// ======================================================
// CONFIGURAÇÕES
// ======================================================

const API = "/api/cozinha/pedidos";
const API_AUTH = "/api/auth";

const INTERVALO_ATUALIZACAO = 5000;

// Quantos pedidos prontos aparecem no card "Prontos".
// Os mais antigos passam para o histórico.
const LIMITE_PRONTOS = 6;

// "recentes" = mais novos primeiro | "antigos" = ordem de chegada (fila)
const ORDEM_FILA = "recentes";

// ======================================================
// ELEMENTOS
// ======================================================

const colunas = {
  novo: document.getElementById("fila-novos"),
  em_preparo: document.getElementById("fila-preparo"),
  pronto: document.getElementById("fila-prontos"),
};

const historicoContainer = document.getElementById("historico");
const buscaHistorico = document.getElementById("busca-historico");
const conexaoStatus = document.getElementById("conexao-status");

// ======================================================
// ESTADO
// ======================================================

let pedidosAtuais = [];
let socket = null;
let intervaloAtualizacao = null;
let usuarioAtual = null;
let reconexaoTentativas = 0;
let reconexaoAgendada = false;

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

function formatarData(data) {
  if (!data) return "Não informado";

  const dataObj = new Date(data);

  if (Number.isNaN(dataObj.getTime())) {
    return "Não informado";
  }

  return dataObj.toLocaleString("pt-BR");
}

function formatarHora(data) {
  const dataObj = new Date(data);

  if (Number.isNaN(dataObj.getTime())) return "--:--";

  return dataObj.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function tempoDecorrido(data) {
  const dataObj = new Date(data);

  if (Number.isNaN(dataObj.getTime())) return "";

  const minutos = Math.max(0, Math.floor((Date.now() - dataObj) / 60000));

  if (minutos < 1) return "agora";
  if (minutos < 60) return `há ${minutos} min`;

  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;

  if (horas < 24) return resto ? `há ${horas} h ${resto} min` : `há ${horas} h`;

  return `há ${Math.floor(horas / 24)} d`;
}

function formatarStatus(status) {
  const nomes = {
    novo: "Novo",
    em_preparo: "Em preparo",
    pronto: "Pronto",
    saiu_para_entrega: "Saiu para entrega",
    entregue: "Entregue",
    retirado: "Retirado",
    concluido: "Concluído",
    cancelado: "Cancelado",
  };

  return nomes[status] || status || "Não informado";
}

function classeStatus(status) {
  const equivalentes = { entregue: "concluido", retirado: "concluido" };

  return `status-${equivalentes[status] || status}`;
}

function mostrarConexao(texto, tipo = "") {
  if (!conexaoStatus) return;

  conexaoStatus.textContent = texto;
  conexaoStatus.className = `cozinha-status ${tipo}`.trim();
}

function notificar(mensagem) {
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("Fraga Lanches", {
      body: mensagem,
      icon: "/assets/images/icons/logo.png",
    });
  }
}

function ordenarPorData(lista, direcao) {
  const tempo = (pedido) => new Date(pedido.data_pedido).getTime() || 0;

  return [...lista].sort((a, b) => direcao * (tempo(a) - tempo(b)));
}

// ======================================================
// REQUISIÇÕES
// ======================================================

async function requisicao(url, opcoes = {}) {
  const resposta = await fetch(url, {
    credentials: "same-origin",
    ...opcoes,
    headers: {
      "Content-Type": "application/json",
      ...(opcoes.headers || {}),
    },
  });

  if (resposta.status === 401) {
    window.location.href = "/cadastro/login.html";
    throw new Error("Sessão expirada.");
  }

  const dados = await resposta.json().catch(() => ({}));

  if (!resposta.ok) {
    throw new Error(dados.mensagem || "Erro na requisição.");
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

    if (!usuarioAtual || usuarioAtual.tipo !== "cozinha") {
      document.body.innerHTML = "<h2>Acesso não autorizado.</h2>";
      return false;
    }

    const nome = document.getElementById("nome-usuario");

    if (nome) {
      nome.textContent = usuarioAtual.nome;
    }

    return true;
  } catch (erro) {
    console.error("Erro ao verificar acesso:", erro);
    return false;
  }
}

// ======================================================
// RESUMO (contadores no topo de cada card)
// ======================================================

function atualizarResumo(pedidos) {
  const contar = (status) => pedidos.filter((p) => p.status === status).length;

  document.getElementById("total-novos").textContent = contar("novo");
  document.getElementById("total-preparo").textContent = contar("em_preparo");
  document.getElementById("total-prontos").textContent = contar("pronto");
}

// ======================================================
// PERSONALIZAÇÕES
// ======================================================

function formatarPersonalizacao(valor) {
  if (!valor) return "";

  try {
    const dados = typeof valor === "string" ? JSON.parse(valor) : valor;

    if (Array.isArray(dados)) {
      return dados
        .map((item) => {
          if (typeof item === "string") return escaparHTML(item);

          return escaparHTML(item.nome || item.descricao || item.titulo || "");
        })
        .filter(Boolean)
        .join(", ");
    }

    if (typeof dados === "object") {
      return escaparHTML(
        dados.nome || dados.descricao || JSON.stringify(dados),
      );
    }

    return escaparHTML(dados);
  } catch {
    return escaparHTML(valor);
  }
}

// ======================================================
// RENDERIZAR TICKET (card de um pedido)
// ======================================================

function renderizarTicket(pedido) {
  const itensHTML = (pedido.itens || [])
    .map((item) => {
      const personalizacao = formatarPersonalizacao(item.personalizacao);

      return `
        <li>
          <strong>${Number(item.quantidade)}x</strong>
          ${escaparHTML(item.nome_produto)}
          ${personalizacao ? `<small>Personalização: ${personalizacao}</small>` : ""}
        </li>
      `;
    })
    .join("");

  let acaoHTML = "";

  if (pedido.status === "novo") {
    acaoHTML = `
      <button type="button" class="tabela-btn btn-status"
        data-id="${pedido.id}" data-status="em_preparo">
        Iniciar preparo
      </button>
    `;
  } else if (pedido.status === "em_preparo") {
    acaoHTML = `
      <button type="button" class="tabela-btn btn-status"
        data-id="${pedido.id}" data-status="pronto">
        Marcar como pronto
      </button>
    `;
  }

  return `
    <article class="cozinha-ticket ${classeStatus(pedido.status)}"
      data-pedido-id="${pedido.id}">

      <div class="ticket-topo">
        <span class="ticket-numero">#${pedido.id}</span>

        <span class="ticket-tempo">
          <strong>${escaparHTML(formatarHora(pedido.data_pedido))}</strong>
          ${escaparHTML(tempoDecorrido(pedido.data_pedido))}
        </span>
      </div>

      <div class="ticket-cliente">
        <span>${escaparHTML(pedido.cliente_nome || "Cliente não informado")}</span>
        <span class="ticket-tipo">
          ${pedido.tipo_entrega === "entrega" ? "Entrega" : "Retirada"}
        </span>
      </div>

      ${
        itensHTML
          ? `<ul class="cozinha-itens">${itensHTML}</ul>`
          : `<span class="cozinha-sem-obs">Sem itens cadastrados.</span>`
      }

      ${
        pedido.observacoes
          ? `<span class="cozinha-obs">${escaparHTML(pedido.observacoes)}</span>`
          : ""
      }

      ${acaoHTML}
    </article>
  `;
}

// ======================================================
// RENDERIZAR CARDS (colunas) E HISTÓRICO
// ======================================================

const mensagensVazias = {
  novo: "Nenhum pedido novo.",
  em_preparo: "Nenhum pedido em preparo.",
  pronto: "Nenhum pedido pronto.",
};

function preservarRolagem(elemento, funcao) {
  const posicao = elemento ? elemento.scrollTop : 0;

  funcao();

  if (elemento) elemento.scrollTop = posicao;
}

function renderizarColuna(status, pedidos) {
  const container = colunas[status];

  preservarRolagem(container, () => {
    container.innerHTML = pedidos.length
      ? pedidos.map(renderizarTicket).join("")
      : `<p class="cozinha-vazio">${mensagensVazias[status]}</p>`;
  });
}

function renderizarHistorico(pedidos) {
  const termo = buscaHistorico.value.trim().toLowerCase();

  const filtrados = ordenarPorData(pedidos, -1).filter((pedido) => {
    if (!termo) return true;

    return (
      String(pedido.id).includes(termo.replace("#", "")) ||
      String(pedido.cliente_nome || "")
        .toLowerCase()
        .includes(termo)
    );
  });

  if (!filtrados.length) {
    historicoContainer.innerHTML = `
      <p class="cozinha-vazio">
        ${termo ? "Nenhum pedido encontrado para a busca." : "Ainda não há pedidos no histórico."}
      </p>
    `;
    return;
  }

  const limite = 100;
  const exibidos = filtrados.slice(0, limite);

  const linhas = exibidos
    .map((pedido) => {
      const resumoItens = (pedido.itens || [])
        .map((item) => `${Number(item.quantidade)}x ${item.nome_produto}`)
        .join(", ");

      return `
        <tr class="pedido-linha" data-pedido-id="${pedido.id}">
          <td>
            <div class="tabela-pedido-identificacao">
              <strong>#${pedido.id}</strong>
              <span class="pedido-status ${classeStatus(pedido.status)}">
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
            <span class="tabela-data">${escaparHTML(formatarData(pedido.data_pedido))}</span>
          </td>

          <td>
            <span class="tabela-modalidade">
              ${pedido.tipo_entrega === "entrega" ? "Entrega" : "Retirada"}
            </span>
          </td>

          <td>
            <span class="tabela-itens-resumo" title="${escaparHTML(resumoItens)}">
              ${escaparHTML(resumoItens || "—")}
            </span>
          </td>
        </tr>
      `;
    })
    .join("");

  const antigoWrapper = historicoContainer.querySelector(
    ".tabela-pedidos-wrapper",
  );

  const posicao = antigoWrapper ? antigoWrapper.scrollTop : 0;

  historicoContainer.innerHTML = `
    <div class="tabela-pedidos-wrapper">
      <table class="tabela-pedidos tabela-historico">
        <thead>
          <tr>
            <th>Pedido</th>
            <th>Cliente</th>
            <th>Data</th>
            <th>Tipo</th>
            <th>Itens</th>
          </tr>
        </thead>
        <tbody>${linhas}</tbody>
      </table>
    </div>

    <div class="tabela-rodape">
      <span>
        Exibindo <strong>${exibidos.length}</strong>
        ${exibidos.length === 1 ? "pedido" : "pedidos"}
        ${filtrados.length > limite ? `de ${filtrados.length}` : ""}
      </span>
    </div>
  `;

  const novoWrapper = historicoContainer.querySelector(
    ".tabela-pedidos-wrapper",
  );

  if (novoWrapper) novoWrapper.scrollTop = posicao;
}

function renderizarPedidos() {
  const direcao = ORDEM_FILA === "antigos" ? 1 : -1;

  const novos = ordenarPorData(
    pedidosAtuais.filter((p) => p.status === "novo"),
    direcao,
  );

  const emPreparo = ordenarPorData(
    pedidosAtuais.filter((p) => p.status === "em_preparo"),
    direcao,
  );

  // Prontos: sempre os mais recentes; os demais vão para o histórico
  const prontosOrdenados = ordenarPorData(
    pedidosAtuais.filter((p) => p.status === "pronto"),
    -1,
  );

  const prontosVisiveis = prontosOrdenados.slice(0, LIMITE_PRONTOS);

  renderizarColuna("novo", novos);
  renderizarColuna("em_preparo", emPreparo);
  renderizarColuna("pronto", prontosVisiveis);

  const idsVisiveis = new Set(
    [...novos, ...emPreparo, ...prontosVisiveis].map((p) => p.id),
  );

  renderizarHistorico(pedidosAtuais.filter((p) => !idsVisiveis.has(p.id)));
}

// ======================================================
// CARREGAR PEDIDOS
// ======================================================

async function carregarPedidos() {
  try {
    const dados = await requisicao(API);

    if (!Array.isArray(dados)) {
      throw new Error("Resposta inválida do servidor.");
    }

    pedidosAtuais = dados;

    atualizarResumo(pedidosAtuais);
    renderizarPedidos();
  } catch (erro) {
    console.error("Erro ao carregar pedidos:", erro);

    Object.values(colunas).forEach((container) => {
      container.innerHTML = `
        <p class="cozinha-vazio">Não foi possível carregar os pedidos.</p>
      `;
    });
  }
}

// ======================================================
// ALTERAR STATUS
// ======================================================

async function alterarStatus(id, status, botao) {
  if (
    !confirm(
      status === "em_preparo"
        ? `Deseja iniciar o preparo do pedido #${id}?`
        : `Deseja marcar o pedido #${id} como pronto?`,
    )
  ) {
    return;
  }

  try {
    botao.disabled = true;

    await requisicao(`${API}/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });

    await carregarPedidos();

    if (status === "em_preparo") {
      notificar(`Pedido #${id} começou a ser preparado.`);
    } else {
      notificar(`Pedido #${id} está pronto.`);
    }
  } catch (erro) {
    alert(erro.message);
    botao.disabled = false;
  }
}

// ======================================================
// EVENTOS
// ======================================================

document.addEventListener("click", (event) => {
  const botao = event.target.closest(".btn-status");

  if (!botao) return;

  alterarStatus(Number(botao.dataset.id), botao.dataset.status, botao);
});

buscaHistorico.addEventListener("input", renderizarPedidos);

document
  .getElementById("btn-atualizar")
  .addEventListener("click", carregarPedidos);

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
    reconexaoTentativas = 0;
    reconexaoAgendada = false;

    mostrarConexao("Conectado em tempo real.", "online");

    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }

    carregarPedidos();
  });

  socket.addEventListener("message", (event) => {
    try {
      const dados = JSON.parse(event.data);

      if (
        dados.evento === "novo_pedido" ||
        dados.evento === "pedido_atualizado"
      ) {
        if (dados.mensagem) {
          notificar(dados.mensagem);
        }

        carregarPedidos();
      }
    } catch (erro) {
      console.error("Erro ao processar evento WebSocket:", erro);
    }
  });

  socket.addEventListener("close", () => {
    mostrarConexao("Reconectando...", "offline");

    if (reconexaoAgendada) return;

    reconexaoAgendada = true;

    const atraso = Math.min(1000 * Math.pow(2, reconexaoTentativas), 30000);

    reconexaoTentativas++;

    setTimeout(() => {
      reconexaoAgendada = false;
      conectarWebSocket();
    }, atraso);
  });

  socket.addEventListener("error", (erro) => {
    console.error("Erro WebSocket:", erro);
    mostrarConexao("Falha na conexão em tempo real.", "offline");
  });
}

// ======================================================
// SAIR
// ======================================================

document.getElementById("btn-sair").addEventListener("click", async () => {
  try {
    if (socket) {
      socket.close();
    }

    if (intervaloAtualizacao) {
      clearInterval(intervaloAtualizacao);
    }

    await fetch(`${API_AUTH}/logout`, {
      method: "POST",
      credentials: "same-origin",
    });
  } catch (erro) {
    console.error("Erro ao sair:", erro);
  } finally {
    window.location.href = "/cadastro/login.html";
  }
});

// ======================================================
// INICIALIZAÇÃO
// ======================================================

async function iniciarPainel() {
  const autorizado = await verificarAcesso();

  if (!autorizado) return;

  await carregarPedidos();

  conectarWebSocket();

  intervaloAtualizacao = setInterval(carregarPedidos, INTERVALO_ATUALIZACAO);
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

    function formatarDataNotificacao(data) {
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
        data.textContent = formatarDataNotificacao(notificacao.data_criacao);

        item.append(tituloItem, mensagem, data);

        item.style.cursor = "pointer";
        item.title = "Abrir pedido relacionado";

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

            if (pedidoId > 0) {
              await carregarPedidos();

              const alvo = document.querySelector(
                `[data-pedido-id="${pedidoId}"]`,
              );

              if (alvo) {
                alvo.scrollIntoView({ behavior: "smooth", block: "center" });
                alvo.classList.add("destaque");
                setTimeout(() => alvo.classList.remove("destaque"), 4000);
              } else {
                console.warn("Pedido não encontrado na cozinha:", pedidoId);
              }
            }
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

    function conectarWebSocketNotificacoes() {
      const protocolo = location.protocol === "https:" ? "wss:" : "ws:";

      const ws = new WebSocket(protocolo + "//" + location.host + "/ws");

      ws.addEventListener("message", function () {
        carregarNotificacoes();
      });

      ws.addEventListener("close", function () {
        setTimeout(conectarWebSocketNotificacoes, 5000);
      });

      ws.addEventListener("error", function () {
        ws.close();
      });
    }

    carregarNotificacoes();
    conectarWebSocketNotificacoes();
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
