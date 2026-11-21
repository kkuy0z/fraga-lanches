"use strict";

// ======================================================
// CONFIGURAÇÕES
// ======================================================

const API_DASHBOARD = "/api/admin/dashboard";
const API_AUTH = "/api/auth";
const URL_LOGIN = "/admin/admin-login.html";
const INTERVALO_ATUALIZACAO = 30000;

// ======================================================
// ELEMENTOS
// ======================================================

const elementos = {
  pedidosHoje: document.getElementById("metricPedidosHoje"),
  pedidosHojeSub: document.getElementById("metricPedidosSub"),

  faturamentoHoje: document.getElementById("metricFaturamentoHoje"),
  faturamentoHojeSub: document.getElementById("metricFaturamentoSub"),

  pedidosPendentes: document.getElementById("metricPendentes"),
  pedidosPendentesSub: document.getElementById("metricPendentesSub"),

  produtosAtivos: document.getElementById("metricProdutosAtivos"),
  produtosAtivosSub: document.getElementById("metricProdutosSub"),

  pedidosRecentes: document.getElementById("tbodyUltimosPedidos"),

  userMenu: document.getElementById("userMenu"),
  userButton: document.getElementById("userButton"),
  userDropdown: document.getElementById("userDropdown"),
  userName: document.getElementById("userName"),
  userAvatar: document.getElementById("userAvatar"),
  dropdownUserName: document.getElementById("dropdownUserName"),
  dropdownUserRole: document.getElementById("dropdownUserRole"),
  logoutBtn: document.getElementById("logoutBtn"),

  navToggle: document.getElementById("adminNavToggle"),
  adminNav: document.getElementById("adminNav"),
};

// ======================================================
// STATUS DOS PEDIDOS
// ======================================================

const STATUS = {
  novo: "Novo",
  em_preparo: "Em preparo",
  pronto: "Pronto",
  saiu_para_entrega: "Saiu para entrega",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

// ======================================================
// UTILITÁRIOS
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
  const numero = Number(valor);

  return (Number.isFinite(numero) ? numero : 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatarData(data) {
  if (!data) return "—";

  let dataFormatada;

  // Evita interpretar DATETIME do MySQL como UTC.
  if (
    typeof data === "string" &&
    /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(data)
  ) {
    const partes = data.replace("T", " ").split(" ");
    const [ano, mes, dia] = partes[0].split("-").map(Number);
    const horario = partes[1].split(":").map(Number);

    dataFormatada = new Date(
      ano,
      mes - 1,
      dia,
      horario[0],
      horario[1],
      horario[2] || 0,
    );
  } else {
    dataFormatada = new Date(data);
  }

  if (Number.isNaN(dataFormatada.getTime())) {
    return "—";
  }

  return dataFormatada.toLocaleString("pt-BR", {
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

function redirecionarLogin() {
  window.location.replace(URL_LOGIN);
}

// ======================================================
// REQUISIÇÕES
// ======================================================

async function requisicao(url, opcoes = {}) {
  const resposta = await fetch(url, {
    credentials: "same-origin",
    ...opcoes,
    headers: {
      Accept: "application/json",
      ...(opcoes.headers || {}),
    },
  });

  const dados = await resposta.json().catch(() => ({}));

  if (resposta.status === 401 || resposta.status === 403) {
    redirecionarLogin();

    const erro = new Error("Sessão inválida ou acesso não autorizado.");
    erro.status = resposta.status;

    throw erro;
  }

  if (!resposta.ok) {
    const erro = new Error(
      dados.mensagem || "Não foi possível realizar a requisição.",
    );

    erro.status = resposta.status;

    throw erro;
  }

  return dados;
}

// ======================================================
// ATUALIZAR ESTATÍSTICAS
// ======================================================

function atualizarEstatisticas(dados) {
  if (elementos.pedidosHoje) {
    elementos.pedidosHoje.textContent = dados.pedidosHoje ?? 0;
  }

  if (elementos.pedidosHojeSub) {
    elementos.pedidosHojeSub.textContent = "Pedidos registrados hoje";
  }

  if (elementos.faturamentoHoje) {
    elementos.faturamentoHoje.textContent = formatarMoeda(
      dados.faturamentoHoje,
    );
  }

  if (elementos.faturamentoHojeSub) {
    elementos.faturamentoHojeSub.textContent = "Pagamentos aprovados hoje";
  }

  if (elementos.pedidosPendentes) {
    elementos.pedidosPendentes.textContent = dados.pedidosPendentes ?? 0;
  }

  if (elementos.pedidosPendentesSub) {
    elementos.pedidosPendentesSub.textContent = "Pedidos em andamento";
  }

  if (elementos.produtosAtivos) {
    elementos.produtosAtivos.textContent = dados.produtosAtivos ?? 0;
  }

  if (elementos.produtosAtivosSub) {
    elementos.produtosAtivosSub.textContent = "Produtos disponíveis";
  }
}

// ======================================================
// ESTADO DA TABELA
// ======================================================

function exibirEstadoPedidos(mensagem) {
  if (!elementos.pedidosRecentes) return;

  elementos.pedidosRecentes.innerHTML = `
    <tr>
      <td colspan="5" class="text-center py-4">
        ${escaparHTML(mensagem)}
      </td>
    </tr>
  `;
}

// ======================================================
// RENDERIZAR PEDIDOS RECENTES
// ======================================================

function renderizarPedidos(pedidos) {
  if (!elementos.pedidosRecentes) return;

  if (!Array.isArray(pedidos) || pedidos.length === 0) {
    exibirEstadoPedidos("Nenhum pedido encontrado.");
    return;
  }

  elementos.pedidosRecentes.innerHTML = pedidos
    .map((pedido) => {
      const id = escaparHTML(pedido.id);
      const cliente = escaparHTML(pedido.cliente || "Cliente não informado");

      const data = escaparHTML(formatarData(pedido.data_pedido));
      const status = escaparHTML(obterStatus(pedido.status));
      const total = formatarMoeda(pedido.total);

      return `
      <tr>
        <td><strong>#${id}</strong></td>
        <td>${cliente}</td>
        <td>${data}</td>
        <td>
          <span class="badge badge-info">${status}</span>
        </td>
        <td><strong>${total}</strong></td>
      </tr>
    `;
    })
    .join("");
}

// ======================================================
// CARREGAR DASHBOARD
// ======================================================

let carregandoDashboard = false;

async function carregarDashboard() {
  if (carregandoDashboard) return;

  carregandoDashboard = true;

  try {
    const dados = await requisicao(API_DASHBOARD, {
      method: "GET",
    });

    atualizarEstatisticas(dados.estatisticas || {});
    renderizarPedidos(dados.pedidosRecentes || []);
  } catch (erro) {
    if (erro.status === 401 || erro.status === 403) {
      return;
    }

    console.error("Erro ao carregar dashboard:", erro);

    exibirEstadoPedidos(
      "Não foi possível carregar os pedidos. Verifique o servidor.",
    );
  } finally {
    carregandoDashboard = false;
  }
}

// ======================================================
// CARREGAR USUÁRIO AUTENTICADO
// ======================================================

async function carregarUsuario() {
  try {
    const dados = await requisicao(`${API_AUTH}/me`, {
      method: "GET",
    });

    const usuario = dados.usuario;

    if (!usuario || usuario.tipo !== "admin") {
      redirecionarLogin();
      return false;
    }

    const nome = usuario.nome || "Administrador";
    const inicial = nome.trim().charAt(0).toUpperCase() || "A";

    if (elementos.userName) {
      elementos.userName.textContent = nome;
    }

    if (elementos.userAvatar) {
      elementos.userAvatar.textContent = inicial;
    }

    if (elementos.dropdownUserName) {
      elementos.dropdownUserName.textContent = nome;
    }

    if (elementos.dropdownUserRole) {
      elementos.dropdownUserRole.textContent = "Administrador";
    }

    return true;
  } catch (erro) {
    if (erro.status !== 401 && erro.status !== 403) {
      console.error("Erro ao carregar usuário:", erro);
    }

    return false;
  }
}

// ======================================================
// MENU DO USUÁRIO
// ======================================================

function fecharMenuUsuario() {
  if (!elementos.userButton || !elementos.userDropdown) return;

  elementos.userButton.setAttribute("aria-expanded", "false");
  elementos.userDropdown.classList.remove("active");
}

function configurarMenuUsuario() {
  if (!elementos.userButton || !elementos.userDropdown) return;

  elementos.userButton.addEventListener("click", (event) => {
    event.stopPropagation();

    const aberto =
      elementos.userButton.getAttribute("aria-expanded") === "true";

    elementos.userButton.setAttribute("aria-expanded", String(!aberto));

    elementos.userDropdown.classList.toggle("active", !aberto);
  });

  document.addEventListener("click", (event) => {
    if (elementos.userMenu && !elementos.userMenu.contains(event.target)) {
      fecharMenuUsuario();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      fecharMenuUsuario();
    }
  });
}

// ======================================================
// LOGOUT
// ======================================================

function configurarLogout() {
  if (!elementos.logoutBtn) return;

  elementos.logoutBtn.addEventListener("click", async () => {
    elementos.logoutBtn.disabled = true;
    elementos.logoutBtn.textContent = "Saindo...";

    try {
      await requisicao(`${API_AUTH}/logout`, {
        method: "POST",
      });

      redirecionarLogin();
    } catch (erro) {
      console.error("Erro ao encerrar sessão:", erro);

      if (erro.status === 401 || erro.status === 403) {
        redirecionarLogin();
        return;
      }

      alert(erro.message || "Não foi possível encerrar a sessão.");

      elementos.logoutBtn.disabled = false;
      elementos.logoutBtn.textContent = "Sair";
    }
  });
}

// ======================================================
// MENU MOBILE
// ======================================================

function configurarMenuMobile() {
  if (!elementos.navToggle || !elementos.adminNav) return;

  elementos.navToggle.addEventListener("click", () => {
    const aberto = elementos.navToggle.getAttribute("aria-expanded") === "true";

    elementos.navToggle.setAttribute("aria-expanded", String(!aberto));

    elementos.adminNav.classList.toggle("active", !aberto);
  });

  elementos.adminNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      elementos.adminNav.classList.remove("active");

      elementos.navToggle.setAttribute("aria-expanded", "false");
    });
  });
}

// ======================================================
// INICIALIZAÇÃO
// ======================================================

async function iniciarDashboard() {
  configurarMenuUsuario();
  configurarLogout();
  configurarMenuMobile();

  const autenticado = await carregarUsuario();

  if (!autenticado) return;

  await carregarDashboard();

  // Atualiza os indicadores a cada 30 segundos.
  window.setInterval(carregarDashboard, INTERVALO_ATUALIZACAO);
}

iniciarDashboard();
