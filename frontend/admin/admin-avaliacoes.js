"use strict";

// ======================================================
// CONFIGURAÇÕES
// ======================================================

const API = "/api/admin/avaliacoes";
const API_AUTH = "/api/auth";

// ======================================================
// ELEMENTOS
// ======================================================

const tbody = document.getElementById("tbodyAvaliacoes");
const buscaAvaliacao = document.getElementById("buscaAvaliacao");
const filtroStatus = document.getElementById("filtroStatus");
const btnAtualizar = document.getElementById("btnAtualizar");
const totalAvaliacoes = document.getElementById("totalAvaliacoes");

const avaliacaoModal = document.getElementById("avaliacaoModal");
const modalBody = document.getElementById("modalBody");
const modalTitulo = document.getElementById("modalTitulo");

// ======================================================
// ESTADO
// ======================================================

let avaliacoes = [];
let temporizadorBusca = null;

// ======================================================
// CONSTANTES
// ======================================================

const STATUS = {
  pendente: "Pendente",
  aprovada: "Aprovada",
  rejeitada: "Rejeitada",
};

const STATUS_CLASSES = {
  pendente: "badge-pendente",
  aprovada: "badge-aprovada",
  rejeitada: "badge-rejeitada",
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

function obterStatus(status) {
  return STATUS[status] || status || "Desconhecido";
}

function obterClasseStatus(status) {
  return STATUS_CLASSES[status] || "";
}

function mostrarMensagem(mensagem) {
  window.alert(mensagem);
}

// ======================================================
// REQUISIÇÕES
// ======================================================

async function requisicao(url, opcoes = {}) {
  const resposta = await fetch(url, {
    credentials: "same-origin",
    cache: "no-store",
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
    console.error("Erro ao autenticar administrador:", erro);
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

  userButton?.addEventListener("click", (evento) => {
    evento.stopPropagation();

    const aberto = userDropdown.classList.toggle("show");

    userButton.setAttribute("aria-expanded", String(aberto));
  });

  document.addEventListener("click", (evento) => {
    if (
      userButton &&
      userDropdown &&
      !userButton.contains(evento.target) &&
      !userDropdown.contains(evento.target)
    ) {
      userDropdown.classList.remove("show");
      userButton.setAttribute("aria-expanded", "false");
    }
  });

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
// CARREGAR AVALIAÇÕES
// ======================================================

async function carregarAvaliacoes() {
  if (!tbody) return;

  tbody.innerHTML = `
    <tr>
      <td colspan="7" class="empty-state">
        Carregando avaliações...
      </td>
    </tr>
  `;

  const parametros = new URLSearchParams();

  const status = filtroStatus?.value || "";
  const busca = buscaAvaliacao?.value.trim() || "";

  if (status) {
    parametros.set("status", status);
  }

  if (busca) {
    parametros.set("busca", busca);
  }

  try {
    const query = parametros.toString();

    const resultado = await requisicao(query ? `${API}?${query}` : API);

    avaliacoes = Array.isArray(resultado.avaliacoes)
      ? resultado.avaliacoes
      : [];

    renderizarAvaliacoes();
  } catch (erro) {
    console.error("Erro ao carregar avaliações:", erro);

    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-state">
          ${escaparHTML(erro.message)}
        </td>
      </tr>
    `;

    if (totalAvaliacoes) {
      totalAvaliacoes.textContent = "Erro ao carregar";
    }
  }
}

// ======================================================
// RENDERIZAR AVALIAÇÕES
// ======================================================

function renderizarAvaliacoes() {
  if (!tbody) return;

  if (totalAvaliacoes) {
    totalAvaliacoes.textContent = `${avaliacoes.length} ${
      avaliacoes.length === 1 ? "avaliação" : "avaliações"
    }`;
  }

  if (!avaliacoes.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-state">
          <strong>Nenhuma avaliação encontrada.</strong>
          Não existem avaliações correspondentes aos filtros.
        </td>
      </tr>
    `;

    return;
  }

  tbody.innerHTML = avaliacoes
    .map((avaliacao) => {
      const id = Number(avaliacao.id);
      const status = avaliacao.status;

      const nota = Number(avaliacao.nota);
      const estrelas = Number.isInteger(nota)
        ? `${"★".repeat(Math.max(0, Math.min(5, nota)))}${"☆".repeat(
            5 - Math.max(0, Math.min(5, nota)),
          )}`
        : "Não informada";

      const comentario = avaliacao.comentario || "Sem comentário.";

      const acoes =
        status === "pendente"
          ? `
            <div class="acoes">
              <button
                type="button"
                class="btn btn-primary"
                data-acao="aprovar"
                data-id="${id}"
              >
                Aprovar
              </button>

              <button
                type="button"
                class="btn btn-danger"
                data-acao="rejeitar"
                data-id="${id}"
              >
                Rejeitar
              </button>

              <button
                type="button"
                class="btn btn-secondary"
                data-acao="detalhes"
                data-id="${id}"
              >
                Ver
              </button>
            </div>
          `
          : `
            <button
              type="button"
              class="btn btn-secondary"
              data-acao="detalhes"
              data-id="${id}"
            >
              Ver detalhes
            </button>
          `;

      return `
        <tr>
          <td>
            <strong>#${id}</strong>
            <br />
            <small>Pedido #${Number(avaliacao.pedido_id)}</small>
          </td>

          <td>
            ${escaparHTML(avaliacao.cliente_nome)}
          </td>

          <td>
            <span class="nota" title="${nota} de 5">
              ${estrelas}
            </span>
            <br />
            <small>${nota}/5</small>
          </td>

          <td>
            <span class="comentario">
              ${escaparHTML(comentario)}
            </span>
          </td>

          <td>
            ${escaparHTML(formatarData(avaliacao.data_avaliacao))}
          </td>

          <td>
            <span class="badge ${obterClasseStatus(status)}">
              ${escaparHTML(obterStatus(status))}
            </span>
          </td>

          <td>
            ${acoes}
          </td>
        </tr>
      `;
    })
    .join("");
}

// ======================================================
// MODAL DE DETALHES
// ======================================================

function abrirDetalhes(id) {
  const avaliacao = avaliacoes.find((item) => Number(item.id) === Number(id));

  if (!avaliacao || !avaliacaoModal || !modalBody) {
    mostrarMensagem("Avaliação não encontrada.");
    return;
  }

  const nota = Number(avaliacao.nota);

  const estrelas = Number.isInteger(nota)
    ? `${"★".repeat(Math.max(0, Math.min(5, nota)))}${"☆".repeat(
        5 - Math.max(0, Math.min(5, nota)),
      )}`
    : "Não informada";

  modalTitulo.textContent = `Avaliação #${avaliacao.id}`;

  modalBody.innerHTML = `
    <div class="form-group">
      <strong>Cliente</strong>
      <p>${escaparHTML(avaliacao.cliente_nome)}</p>
    </div>

    <div class="form-group">
      <strong>Pedido</strong>
      <p>#${Number(avaliacao.pedido_id)}</p>
    </div>

    <div class="form-group">
      <strong>Nota</strong>
      <p class="nota">${estrelas} (${nota}/5)</p>
    </div>

    <div class="form-group">
      <strong>Comentário</strong>
      <p>${escaparHTML(avaliacao.comentario || "Sem comentário.")}</p>
    </div>

    <div class="form-group">
      <strong>Data da avaliação</strong>
      <p>${escaparHTML(formatarData(avaliacao.data_avaliacao))}</p>
    </div>

    <div class="form-group">
      <strong>Situação</strong>
      <p>
        <span class="badge ${obterClasseStatus(avaliacao.status)}">
          ${escaparHTML(obterStatus(avaliacao.status))}
        </span>
      </p>
    </div>

    ${
      avaliacao.moderador_nome
        ? `
          <div class="form-group">
            <strong>Moderado por</strong>
            <p>${escaparHTML(avaliacao.moderador_nome)}</p>
          </div>
        `
        : ""
    }

    ${
      avaliacao.data_moderacao
        ? `
          <div class="form-group">
            <strong>Data da moderação</strong>
            <p>${escaparHTML(formatarData(avaliacao.data_moderacao))}</p>
          </div>
        `
        : ""
    }

    ${
      avaliacao.status === "rejeitada" && avaliacao.motivo_rejeicao
        ? `
          <div class="form-group">
            <strong>Motivo da rejeição</strong>
            <p>${escaparHTML(avaliacao.motivo_rejeicao)}</p>
          </div>
        `
        : ""
    }
  `;

  avaliacaoModal.classList.remove("hidden");
}

function fecharDetalhes() {
  avaliacaoModal?.classList.add("hidden");
}

// ======================================================
// MODERAÇÃO
// ======================================================

async function moderarAvaliacao(id, status) {
  const avaliacao = avaliacoes.find((item) => Number(item.id) === Number(id));

  if (!avaliacao) {
    mostrarMensagem("Avaliação não encontrada.");
    return;
  }

  if (avaliacao.status !== "pendente") {
    mostrarMensagem("Esta avaliação já foi moderada.");
    return;
  }

  let motivo = "";

  if (status === "aprovada") {
    const confirmar = window.confirm(
      `Deseja aprovar a avaliação #${id}?\n\nEla poderá ser exibida na página inicial.`,
    );

    if (!confirmar) return;
  }

  if (status === "rejeitada") {
    motivo = window.prompt(`Informe o motivo da rejeição da avaliação #${id}:`);

    if (motivo === null) return;

    motivo = motivo.trim();

    if (!motivo) {
      mostrarMensagem("O motivo da rejeição é obrigatório.");
      return;
    }

    if (motivo.length > 500) {
      mostrarMensagem("O motivo deve ter no máximo 500 caracteres.");
      return;
    }
  }

  const botao = tbody.querySelector(
    `[data-id="${id}"][data-acao="${status === "aprovada" ? "aprovar" : "rejeitar"}"]`,
  );

  if (botao) {
    botao.disabled = true;
    botao.textContent = "Salvando...";
  }

  try {
    const resultado = await requisicao(`${API}/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({
        status,
        motivo,
      }),
    });

    mostrarMensagem(resultado.mensagem || "Avaliação moderada com sucesso.");

    await carregarAvaliacoes();
  } catch (erro) {
    console.error("Erro ao moderar avaliação:", erro);

    mostrarMensagem(erro.message);

    if (botao) {
      botao.disabled = false;
      botao.textContent = status === "aprovada" ? "Aprovar" : "Rejeitar";
    }
  }
}

// ======================================================
// EVENTOS
// ======================================================

function configurarEventos() {
  tbody?.addEventListener("click", (evento) => {
    const botao = evento.target.closest("[data-acao]");

    if (!botao) return;

    const id = Number(botao.dataset.id);

    if (!id) return;

    switch (botao.dataset.acao) {
      case "detalhes":
        abrirDetalhes(id);
        break;

      case "aprovar":
        moderarAvaliacao(id, "aprovada");
        break;

      case "rejeitar":
        moderarAvaliacao(id, "rejeitada");
        break;
    }
  });

  buscaAvaliacao?.addEventListener("input", () => {
    clearTimeout(temporizadorBusca);

    temporizadorBusca = setTimeout(() => {
      carregarAvaliacoes();
    }, 350);
  });

  filtroStatus?.addEventListener("change", carregarAvaliacoes);

  btnAtualizar?.addEventListener("click", carregarAvaliacoes);

  document
    .getElementById("modalClose")
    ?.addEventListener("click", fecharDetalhes);

  document
    .getElementById("modalFechar")
    ?.addEventListener("click", fecharDetalhes);

  avaliacaoModal?.addEventListener("click", (evento) => {
    if (evento.target === avaliacaoModal) {
      fecharDetalhes();
    }
  });

  document.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape") {
      fecharDetalhes();
    }
  });
}

// ======================================================
// INICIALIZAÇÃO
// ======================================================

async function iniciar() {
  configurarMenu();
  configurarEventos();

  const autenticado = await carregarUsuario();

  if (!autenticado) {
    return;
  }

  await carregarAvaliacoes();

  console.log("[ADMIN AVALIAÇÕES] Inicializado com sucesso.");
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

