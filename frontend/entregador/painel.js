"use strict";

// ======================================================
// CONFIGURAÇÕES
// ======================================================

const API_AUTH = "/api/auth";
const API_PERFIL = "/api/entregador/perfil";
const API_ENTREGAS = "/api/entregador/entregas";
const API_FINANCEIRO = "/api/entregador/financeiro";

let usuarioAtual = null;
let atualizandoEntregas = false;

// ======================================================
// ELEMENTOS
// ======================================================

const nomeUsuario = document.getElementById("nome-usuario");
const btnSair = document.getElementById("btn-sair");

const formPerfil = document.getElementById("formPerfil");
const perfilNome = document.getElementById("perfilNome");
const perfilEmail = document.getElementById("perfilEmail");
const perfilTelefone = document.getElementById("perfilTelefone");
const btnSalvarPerfil = document.getElementById("btnSalvarPerfil");
const mensagemPerfil = document.getElementById("mensagemPerfil");

const containerEntregas = document.getElementById("entregas");

// ======================================================
// UTILITÁRIOS
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

  const dados = await resposta.json().catch(() => ({}));

  if (!resposta.ok) {
    throw new Error(dados.mensagem || "Não foi possível concluir a operação.");
  }

  return dados;
}

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
  if (!valor) return "Não informado";

  const data = new Date(String(valor).replace(" ", "T"));

  if (Number.isNaN(data.getTime())) {
    return "Não informado";
  }

  return data.toLocaleString("pt-BR");
}


// ======================================================
// FINANCEIRO
// ======================================================

function renderizarFinanceiro(dados) {
  const total = document.getElementById("financeiroTotal");
  const quantidade = document.getElementById("financeiroQuantidade");
  const historico = document.getElementById("financeiroHistorico");

  if (!total || !quantidade || !historico) return;

  total.textContent = formatarMoeda(dados.totalGanho);
  quantidade.textContent = String(Number(dados.quantidadeEntregas || 0));

  const registros = Array.isArray(dados.historico) ? dados.historico : [];

  if (!registros.length) {
    historico.innerHTML = '<p class="financeiro-vazio">Você ainda não possui entregas com recebimento confirmado.</p>';
    return;
  }

  historico.innerHTML = registros.map((item) => `
    <article class="financeiro-linha">
      <div>
        <strong>Pedido #${Number(item.pedido_id)}</strong>
        <small>Concluído em ${escaparHTML(formatarData(item.data_conclusao))}</small>
      </div>
      <strong class="financeiro-valor">+${formatarMoeda(item.valor_ganho)}</strong>
    </article>
  `).join("");
}

async function carregarFinanceiro() {
  try {
    const dados = await requisicao(API_FINANCEIRO);
    renderizarFinanceiro(dados);
  } catch (erro) {
    console.error("Erro ao carregar financeiro:", erro);
    const historico = document.getElementById("financeiroHistorico");
    if (historico) {
      historico.innerHTML = '<p class="ent-erro">Não foi possível carregar seu financeiro.</p>';
    }
  }
}

// ======================================================
// GOOGLE MAPS
// ======================================================

function gerarLinkRota(entrega) {
  const rua = String(entrega.rua || "").trim();
  const numero = String(entrega.numero || "").trim();
  const bairro = String(entrega.bairro || "").trim();
  const cidade = String(entrega.cidade || "").trim();
  const complemento = String(entrega.complemento || "").trim();

  if (!rua || !numero || !cidade) {
    return null;
  }

  const endereco = [rua, numero, complemento, bairro, cidade, "MG", "Brasil"]
    .filter(Boolean)
    .join(", ");

  const parametros = new URLSearchParams({
    api: "1",
    destination: endereco,
    travelmode: "driving",
  });

  return `https://www.google.com/maps/dir/?${parametros.toString()}`;
}

function mostrarMensagemPerfil(mensagem, erro = false) {
  if (!mensagemPerfil) return;

  mensagemPerfil.textContent = mensagem;
  mensagemPerfil.style.color = erro ? "#fca5a5" : "#f5c542";
}

// ======================================================
// FORMATAR PERSONALIZAÇÃO DOS ITENS
// ======================================================

function formatarPersonalizacao(valor) {
  if (!valor) return "";

  let dados = valor;

  if (typeof dados === "string") {
    try {
      dados = JSON.parse(dados);
    } catch {
      return dados.trim();
    }
  }

  if (Array.isArray(dados)) {
    const nomes = dados
      .map((item) => {
        if (typeof item === "string") return item;

        if (item && typeof item === "object") {
          return (
            item.nome ||
            item.nome_produto ||
            item.descricao ||
            item.titulo ||
            ""
          );
        }

        return "";
      })
      .filter(Boolean);

    return nomes.join(", ");
  }

  if (dados && typeof dados === "object") {
    const nomes = [];

    if (Array.isArray(dados.adicionais)) {
      dados.adicionais.forEach((item) => {
        if (typeof item === "string") {
          nomes.push(item);
        } else if (item && typeof item === "object") {
          const nome = item.nome || item.nome_produto || item.descricao;

          if (nome) nomes.push(nome);
        }
      });
    }

    if (Array.isArray(dados.opcoes)) {
      dados.opcoes.forEach((item) => {
        if (typeof item === "string") {
          nomes.push(item);
        } else if (item && typeof item === "object") {
          const nome = item.nome || item.descricao;

          if (nome) nomes.push(nome);
        }
      });
    }

    if (dados.observacao) {
      nomes.push(dados.observacao);
    }

    if (dados.observacoes) {
      nomes.push(dados.observacoes);
    }

    if (nomes.length) {
      return nomes.join(", ");
    }

    return "";
  }

  return String(dados);
}

// ======================================================
// AUTENTICAÇÃO
// ======================================================

async function verificarAcesso() {
  try {
    const dados = await requisicao(`${API_AUTH}/me`);

    if (!dados.usuario || dados.usuario.tipo !== "entregador") {
      throw new Error("Acesso permitido somente para entregadores.");
    }

    usuarioAtual = dados.usuario;

    if (nomeUsuario) {
      nomeUsuario.textContent = usuarioAtual.nome;
    }

    return true;
  } catch (erro) {
    console.error("Erro de autenticação:", erro);
    window.location.href = "/";
    return false;
  }
}

// ======================================================
// PERFIL
// ======================================================

async function carregarPerfil() {
  try {
    const dados = await requisicao(API_PERFIL);
    const usuario = dados.usuario;

    perfilNome.value = usuario.nome || "";
    perfilEmail.value = usuario.email || "";
    perfilTelefone.value = usuario.telefone || "";

    if (nomeUsuario) {
      nomeUsuario.textContent = usuario.nome;
    }

    usuarioAtual = usuario;
  } catch (erro) {
    console.error("Erro ao carregar perfil:", erro);
    mostrarMensagemPerfil(erro.message, true);
  }
}

async function salvarPerfil(evento) {
  evento.preventDefault();

  const nome = perfilNome.value.trim();
  const telefone = perfilTelefone.value.trim();

  if (nome.length < 2) {
    mostrarMensagemPerfil("Informe seu nome completo.", true);
    return;
  }

  btnSalvarPerfil.disabled = true;
  btnSalvarPerfil.textContent = "Salvando...";

  try {
    const dados = await requisicao(API_PERFIL, {
      method: "PATCH",
      body: JSON.stringify({
        nome,
        telefone,
      }),
    });

    usuarioAtual = dados.usuario;

    if (nomeUsuario) {
      nomeUsuario.textContent = dados.usuario.nome;
    }

    perfilNome.value = dados.usuario.nome || "";
    perfilTelefone.value = dados.usuario.telefone || "";

    mostrarMensagemPerfil(dados.mensagem || "Perfil atualizado com sucesso.");
  } catch (erro) {
    mostrarMensagemPerfil(erro.message, true);
  } finally {
    btnSalvarPerfil.disabled = false;
    btnSalvarPerfil.textContent = "Salvar alterações";
  }
}

// ======================================================
// STATUS DAS ENTREGAS
// ======================================================

function formatarStatus(status) {
  const statusMap = {
    pendente: "Pendente",
    atribuida: "Atribuída",
    em_andamento: "Em andamento",
    entregue: "Entregue",
  };

  return statusMap[status] || status;
}

// ======================================================
// AÇÕES DISPONÍVEIS PARA CADA ENTREGA
// ======================================================

function gerarAcoesEntrega(entrega) {
  if (
    entrega.status_entrega === "atribuida" &&
    entrega.status_pedido === "pronto"
  ) {
    return `
      <button
        type="button"
        class="ent-btn ent-btn-iniciar"
        data-acao="iniciar"
        data-id="${Number(entrega.entrega_id)}"
      >
        Iniciar entrega
      </button>
    `;
  }

  if (entrega.status_entrega === "atribuida") {
    return `
      <p class="ent-aviso">
        Aguardando o pedido ficar pronto.
      </p>
    `;
  }

  if (entrega.status_entrega === "em_andamento") {
    const linkRota = gerarLinkRota(entrega);

    const botaoRota = linkRota
      ? `
        <a
          href="${escaparHTML(linkRota)}"
          target="_blank"
          rel="noopener noreferrer"
          class="ent-btn ent-btn-iniciar"
        >
          📍 Abrir rota no Google Maps
        </a>
      `
      : `
        <p class="ent-aviso">
          Não foi possível gerar a rota.
          Verifique o endereço do cliente.
        </p>
      `;

    return `
      <div class="ent-acoes-entrega">
        ${botaoRota}

        <button
          type="button"
          class="ent-btn ent-btn-finalizar"
          data-acao="finalizar"
          data-id="${Number(entrega.entrega_id)}"
        >
          Confirmar que entreguei
        </button>
      </div>
    `;
  }

  if (entrega.status_entrega === "entregue") {
    return `
      <p class="ent-concluida">
        Entrega informada como realizada.
      </p>
    `;
  }

  return "";
}

// ======================================================
// RENDERIZAR ENTREGAS
// ======================================================

function renderizarEntregas(entregas) {
  if (!containerEntregas) return;

  if (!entregas || entregas.length === 0) {
    containerEntregas.innerHTML = `
      <div class="ent-vazio">
        <strong>Nenhuma entrega atribuída</strong>

        <p>
          Quando um pedido for atribuído a você,
          ele aparecerá nesta área.
        </p>
      </div>
    `;

    return;
  }

  containerEntregas.innerHTML = entregas
    .map((entrega) => {
      const endereco = [
        entrega.rua,
        entrega.numero,
        entrega.complemento,
        entrega.bairro,
        entrega.cidade,
      ]
        .filter(Boolean)
        .join(", ");

      const itensHTML = (entrega.itens || [])
        .map((item) => {
          const personalizacao = formatarPersonalizacao(item.personalizacao);

          return `
            <li>
              <span>
                ${escaparHTML(item.quantidade)}x
                ${escaparHTML(item.nome_produto)}
              </span>

              <strong>
                ${formatarMoeda(item.subtotal)}
              </strong>

              ${
                personalizacao
                  ? `<small>${escaparHTML(personalizacao)}</small>`
                  : ""
              }
            </li>
          `;
        })
        .join("");

      const acaoHTML = gerarAcoesEntrega(entrega);

      return `
        <article class="entrega-item">

          <div class="entrega-topo">
            <div>
              <strong>
                Pedido #${Number(entrega.pedido_id)}
              </strong>

              <span class="entrega-status">
                ${escaparHTML(formatarStatus(entrega.status_entrega))}
              </span>
            </div>

            <strong class="entrega-total">
              ${formatarMoeda(entrega.total)}
            </strong>
          </div>

          <div class="entrega-info">
            <h4>Cliente</h4>

            <p>
              ${escaparHTML(entrega.cliente_nome)}
            </p>

            <p>
              ${escaparHTML(
                entrega.cliente_telefone || "Telefone não informado",
              )}
            </p>
          </div>

          <div class="entrega-info">
            <h4>Endereço</h4>

            <p>
              ${escaparHTML(endereco || "Endereço não informado")}
            </p>
          </div>

          <div class="entrega-info">
            <h4>Itens do pedido</h4>

            <ul class="entrega-itens">
              ${itensHTML || "<li>Sem itens cadastrados.</li>"}
            </ul>
          </div>

          ${
            entrega.observacoes
              ? `
                <div class="entrega-info">
                  <h4>Observações</h4>

                  <p>
                    ${escaparHTML(entrega.observacoes)}
                  </p>
                </div>
              `
              : ""
          }

          <div class="entrega-horarios">
            ${
              entrega.data_saida
                ? `
                  <p>
                    Saída:
                    ${escaparHTML(formatarData(entrega.data_saida))}
                  </p>
                `
                : ""
            }

            ${
              entrega.data_entrega
                ? `
                  <p>
                    Entrega informada:
                    ${escaparHTML(formatarData(entrega.data_entrega))}
                  </p>
                `
                : ""
            }
          </div>

          ${acaoHTML}

        </article>
      `;
    })
    .join("");
}

// ======================================================
// CARREGAR ENTREGAS
// ======================================================

async function carregarEntregas() {
  if (atualizandoEntregas) return;

  atualizandoEntregas = true;

  try {
    const dados = await requisicao(API_ENTREGAS);

    renderizarEntregas(dados.entregas || []);
  } catch (erro) {
    console.error("Erro ao carregar entregas:", erro);

    if (containerEntregas) {
      containerEntregas.innerHTML = `
        <p class="ent-erro">
          ${escaparHTML(erro.message)}
        </p>
      `;
    }
  } finally {
    atualizandoEntregas = false;
  }
}

// ======================================================
// AÇÕES DE ENTREGA
// ======================================================

async function executarAcaoEntrega(acao, id, botao) {
  const mensagens = {
    iniciar: {
      confirmacao: "Deseja iniciar esta entrega?",
      url: `${API_ENTREGAS}/${id}/iniciar`,
      sucesso: "Entrega iniciada com sucesso.",
    },

    finalizar: {
      confirmacao: "Confirma que o pedido foi entregue ao cliente?",
      url: `${API_ENTREGAS}/${id}/finalizar`,
      sucesso: "Entrega informada como realizada.",
    },
  };

  const configuracao = mensagens[acao];

  if (!configuracao) return;

  if (!window.confirm(configuracao.confirmacao)) {
    return;
  }

  botao.disabled = true;
  botao.textContent = "Processando...";

  try {
    const dados = await requisicao(configuracao.url, {
      method: "PATCH",
    });

    window.alert(dados.mensagem || configuracao.sucesso);

    await carregarEntregas();
  } catch (erro) {
    window.alert(erro.message);

    await carregarEntregas();
  }
}

// ======================================================
// SAIR
// ======================================================

async function sair() {
  try {
    await requisicao(`${API_AUTH}/logout`, {
      method: "POST",
    });
  } catch (erro) {
    console.error("Erro ao encerrar sessão:", erro);
  }

  window.location.href = "/";
}

// ======================================================
// EVENTOS
// ======================================================

function configurarEventos() {
  if (formPerfil) {
    formPerfil.addEventListener("submit", salvarPerfil);
  }

  if (btnSair) {
    btnSair.addEventListener("click", sair);
  }

  if (containerEntregas) {
    containerEntregas.addEventListener("click", (evento) => {
      const botao = evento.target.closest("[data-acao]");

      if (!botao) return;

      const acao = botao.dataset.acao;
      const id = Number(botao.dataset.id);

      if (!Number.isInteger(id) || id <= 0) return;

      executarAcaoEntrega(acao, id, botao);
    });
  }
}

// ======================================================
// INICIALIZAÇÃO
// ======================================================

async function iniciarPainel() {
  configurarEventos();

  const autorizado = await verificarAcesso();

  if (!autorizado) return;

  await Promise.all([carregarPerfil(), carregarEntregas(), carregarFinanceiro()]);

  window.setInterval(carregarEntregas, 15000);
  window.setInterval(carregarFinanceiro, 30000);
}

document.addEventListener("DOMContentLoaded", iniciarPainel);



/* =====================================================
   CENTRAL DE NOTIFICAÇÕES FRAGA LANCHES
   ===================================================== */
(function () {
    "use strict";

    if (window.fragaNotificacoesIniciado) return;
    window.fragaNotificacoesIniciado = true;

    function iniciarNotificacoes() {
        const cabecalho = document.querySelector(".ent-header-actions");

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
                            const resposta = await fetch("/api/notificacoes/" + encodeURIComponent(notificacao.id) + "/lida", { method: "PATCH", credentials: "same-origin" });
                            if (resposta.ok) await carregarNotificacoes();
                        }
                        const pedidoId = Number(notificacao.pedido_id);
                        if (pedidoId > 0) { await carregarEntregas(); const card=Array.from(document.querySelectorAll(".entrega-item")).find(el=>el.textContent.includes("Pedido #"+pedidoId)); if(card){card.scrollIntoView({behavior:"smooth",block:"center"});card.style.outline="3px solid #44B7F8";card.style.outlineOffset="4px";setTimeout(()=>{card.style.outline="";card.style.outlineOffset="";},4000);}else console.warn("Entrega não encontrada:",pedidoId); }
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
            const area = document.querySelector(".ent-header-actions");

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

