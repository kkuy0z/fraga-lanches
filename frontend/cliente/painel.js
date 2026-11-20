const TIPO_PERMITIDO = "cliente";

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
