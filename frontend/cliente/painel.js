const TIPO_PERMITIDO = "cliente";

const formatarMoeda = (valor) =>
  Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

const statusTexto = {
  novo: "Recebido",
  em_preparo: "Em preparo",
  pronto: "Pronto",
  saiu_para_entrega: "Saiu para entrega",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

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

function classeStatus(status) {
  if (status === "concluido") return "concluido";
  if (status === "cancelado") return "cancelado";
  return "";
}

function mostrarErro(mensagem) {
  const elemento = document.getElementById("mensagem-erro");

  elemento.textContent = mensagem;
  elemento.hidden = false;
}

function renderizarIndicadores(indicadores) {
  document.getElementById("total-pedidos").textContent =
    indicadores.pedidosTotal;

  document.getElementById("pedidos-andamento").textContent =
    indicadores.emAndamento;

  document.getElementById("pedidos-concluidos").textContent =
    indicadores.concluidos;

  document.getElementById("total-gasto").textContent = formatarMoeda(
    indicadores.totalGasto,
  );
}

function renderizarPedidoAtual(pedido) {
  const container = document.getElementById("pedido-atual");

  if (!pedido) {
    container.innerHTML = `
            <div class="estado-vazio">
                <div class="estado-icone">🍔</div>
                <h3>Nenhum pedido em andamento</h3>
                <p>
                    Quando você fizer um pedido, poderá acompanhar
                    o andamento dele por aqui.
                </p>
                <a href="/cliente/cardapio.html" class="botao-secundario">
                    Explorar cardápio
                </a>
            </div>
        `;
    return;
  }

  const etapas = ["novo", "em_preparo", "pronto", "saiu_para_entrega"];

  const etapaAtual = etapas.indexOf(pedido.status);

  const progresso = etapas
    .map(
      (etapa, indice) => `
        <div class="progresso-etapa ${indice <= etapaAtual ? "ativa" : ""}"></div>
    `,
    )
    .join("");

  const itens = (pedido.itens || [])
    .map(
      (item) => `
        <li>
            ${item.quantidade}x ${escaparHTML(item.nome)}
            ${
              item.personalizacao
                ? ` — ${escaparHTML(item.personalizacao)}`
                : ""
            }
        </li>
    `,
    )
    .join("");

  container.innerHTML = `
        <div class="pedido-atual-conteudo">

            <div>
                <div class="pedido-atual-topo">
                    <strong>Pedido #${pedido.id}</strong>

                    <span class="status ${classeStatus(pedido.status)}">
                        ${statusTexto[pedido.status] || pedido.status}
                    </span>
                </div>

                <div class="pedido-data">
                    Realizado em ${escaparHTML(pedido.data)}
                    · ${pedido.tipo_entrega === "retirada" ? "Retirada" : "Entrega"}
                </div>
            </div>

            <div class="pedido-atual-valor">
                <strong>${formatarMoeda(pedido.total)}</strong>
                <span>Valor do pedido</span>
            </div>

        </div>

        <div class="pedido-progresso">
            ${progresso}
        </div>

        <div class="pedido-etapas-legenda">
            <span>Recebido</span>
            <span>Preparando</span>
            <span>Pronto</span>
            <span>Finalizado</span>
        </div>

        ${
          itens
            ? `
            <div class="pedido-itens">
                <strong>Itens deste pedido</strong>
                <ul>${itens}</ul>
            </div>
        `
            : ""
        }
    `;
}

function renderizarPedidos(pedidos) {
  const container = document.getElementById("lista-pedidos");

  if (!pedidos || pedidos.length === 0) {
    container.innerHTML = `
            <div class="lista-vazia">
                Você ainda não realizou nenhum pedido.
                <br><br>
                <a href="/cliente/cardapio.html" class="botao-secundario">
                    Conhecer o cardápio
                </a>
            </div>
        `;
    return;
  }

  container.innerHTML = pedidos
    .map((pedido) => {
      const resumoItens = (pedido.itens || [])
        .map((item) => `${item.quantidade}x ${escaparHTML(item.nome)}`)
        .join(", ");

      return `
            <article class="pedido-card">

                <div class="pedido-card-info">
                    <strong>Pedido #${pedido.id}</strong>

                    <small>${escaparHTML(pedido.data)}</small>

                    <span class="pedido-card-itens">
                        ${resumoItens || "Itens do pedido"}
                    </span>
                </div>

                <div class="pedido-card-valor">
                    <span class="status ${classeStatus(pedido.status)}">
                        ${statusTexto[pedido.status] || pedido.status}
                    </span>

                    <strong>${formatarMoeda(pedido.total)}</strong>
                </div>

            </article>
        `;
    })
    .join("");
}

async function carregarDashboard() {
  try {
    const resposta = await fetch("/api/auth/me", {
      method: "GET",
      credentials: "same-origin",
    });

    if (resposta.status === 401) {
      window.location.href = "/cadastro/login.html";
      return;
    }

    if (!resposta.ok) {
      throw new Error("Erro ao verificar autenticação.");
    }

    const dados = await resposta.json();
    const usuario = dados.usuario;

    if (!usuario || usuario.tipo !== TIPO_PERMITIDO) {
      document.body.innerHTML = `
                <h2>Acesso não autorizado.</h2>
                <a href="/cadastro/login.html">Voltar ao login</a>
            `;
      return;
    }

    const nomeUsuario = document.getElementById("nome-usuario");

    if (nomeUsuario) {
      nomeUsuario.textContent = usuario.nome;
    }
    const respostaDashboard = await fetch("/api/cliente/dashboard", {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!respostaDashboard.ok) {
      throw new Error("Não foi possível carregar seus pedidos.");
    }
    const dadosDashboard = await respostaDashboard.json();
    const totalPedidos = document.getElementById("pedidos-feitos");
    if (totalPedidos) {
      totalPedidos.textContent = Number(dadosDashboard.indicadores?.pedidosTotal || 0);
    }
  } catch (erro) {
    console.error("Erro ao verificar acesso:", erro);

    document.body.innerHTML = `
            <h2>Não foi possível conectar ao servidor.</h2>
            <button onclick="location.reload()">Tentar novamente</button>
        `;
  }
}

const botaoSair = document.getElementById("btn-sair");

if (botaoSair) {
  botaoSair.addEventListener("click", async () => {
    botaoSair.disabled = true;

    try {
      const resposta = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });

      if (!resposta.ok) {
        throw new Error("Não foi possível encerrar a sessão.");
      }

      window.location.href = "/cadastro/login.html";
    } catch (erro) {
      console.error("Erro ao sair:", erro);
      botaoSair.disabled = false;
      alert("Não foi possível sair. Tente novamente.");
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", carregarDashboard);
} else {
  carregarDashboard();
}



/* =====================================================
   CENTRAL DE NOTIFICAÇÕES FRAGA LANCHES
   ===================================================== */
(function () {
    "use strict";

    if (window.fragaNotificacoesIniciado) return;
    window.fragaNotificacoesIniciado = true;

    function iniciarNotificacoes() {
        const cabecalho = document.querySelector(".pnl-nav");

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

        cabecalho.insertBefore(container,cabecalho.querySelector("#btn-sair"));

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
            const area = document.querySelector(".pnl-nav");

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

