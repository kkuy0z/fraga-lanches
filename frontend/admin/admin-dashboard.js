"use strict";

const API = "/api/admin/dashboard";

const elementos = {
  pedidosHoje: document.getElementById("statPedidosHoje"),
  pedidosEntregues: document.getElementById("statPedidosEntregues"),
  pedidosPendentes: document.getElementById("statPedidosPendentes"),
  produtosAtivos: document.getElementById("statProdutosAtivos"),
  categorias: document.getElementById("statCategorias"),
  clientes: document.getElementById("statClientes"),
  pedidosRecentes: document.getElementById("tbodyPedidosRecentes"),

  userButton: document.getElementById("userButton"),
  userDropdown: document.getElementById("userDropdown"),
  userName: document.getElementById("userName"),
  userAvatar: document.getElementById("userAvatar"),
  dropdownUserName: document.getElementById("dropdownUserName"),
  logoutBtn: document.getElementById("logoutBtn"),

  navToggle: document.getElementById("adminNavToggle"),
  adminNav: document.getElementById("adminNav"),
};

const STATUS = {
  novo: "Novo",
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

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatarData(data) {
  if (!data) return "—";

  const dataFormatada = new Date(data);

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

function atualizarEstatisticas(dados) {
  elementos.pedidosHoje.textContent = dados.pedidosHoje ?? 0;
  elementos.pedidosEntregues.textContent = dados.pedidosEntregues ?? 0;
  elementos.pedidosPendentes.textContent = dados.pedidosPendentes ?? 0;
  elementos.produtosAtivos.textContent = dados.produtosAtivos ?? 0;
  elementos.categorias.textContent = dados.categorias ?? 0;
  elementos.clientes.textContent = dados.clientes ?? 0;
}

function renderizarPedidos(pedidos) {
  if (!Array.isArray(pedidos) || pedidos.length === 0) {
    elementos.pedidosRecentes.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-4">
                    Nenhum pedido encontrado.
                </td>
            </tr>
        `;
    return;
  }

  elementos.pedidosRecentes.innerHTML = pedidos
    .map(
      (pedido) => `
        <tr>
            <td>
                <strong>#${escaparHTML(pedido.id)}</strong>
            </td>

            <td>
                ${escaparHTML(pedido.cliente)}
            </td>

            <td>
                ${escaparHTML(formatarData(pedido.data_pedido))}
            </td>

            <td>
                <span class="badge badge-info">
                    ${escaparHTML(obterStatus(pedido.status))}
                </span>
            </td>

            <td>
                <strong>${formatarMoeda(pedido.total)}</strong>
            </td>

            <td>
                <a
                    href="/admin/admin-pedidos.html"
                    class="btn btn-secondary btn-sm">
                    Ver pedidos
                </a>
            </td>
        </tr>
    `,
    )
    .join("");
}

async function carregarDashboard() {
  try {
    const resposta = await fetch(API, {
      method: "GET",
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
      },
    });

    const dados = await resposta.json();

    if (resposta.status === 401 || resposta.status === 403) {
      window.location.href = "/admin/admin-login.html";
      return;
    }

    if (!resposta.ok) {
      throw new Error(dados.mensagem || "Erro ao carregar o dashboard.");
    }

    atualizarEstatisticas(dados.estatisticas || {});
    renderizarPedidos(dados.pedidosRecentes || []);
  } catch (erro) {
    console.error("Erro no dashboard:", erro);

    elementos.pedidosRecentes.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-4">
                    Não foi possível carregar os pedidos.
                    Verifique sua conexão com o servidor.
                </td>
            </tr>
        `;
  }
}

async function carregarUsuario() {
  try {
    const resposta = await fetch("/api/auth/me", {
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
      },
    });

    if (resposta.status === 401 || resposta.status === 403) {
      window.location.href = "/admin/admin-login.html";
      return;
    }

    if (!resposta.ok) return;

    const dados = await resposta.json();
    const usuario = dados.usuario;

    if (!usuario) return;

    const nome = usuario.nome || "Administrador";
    const inicial = nome.trim().charAt(0).toUpperCase();

    elementos.userName.textContent = nome;
    elementos.userAvatar.textContent = inicial;
    elementos.dropdownUserName.textContent = nome;
  } catch (erro) {
    console.error("Erro ao carregar usuário:", erro);
  }
}

function configurarMenuUsuario() {
  if (!elementos.userButton || !elementos.userDropdown) return;

  elementos.userButton.addEventListener("click", () => {
    const aberto =
      elementos.userButton.getAttribute("aria-expanded") === "true";

    elementos.userButton.setAttribute("aria-expanded", String(!aberto));
    elementos.userDropdown.classList.toggle("active", !aberto);
  });

  document.addEventListener("click", (event) => {
    const menu = document.getElementById("userMenu");

    if (menu && !menu.contains(event.target)) {
      elementos.userButton.setAttribute("aria-expanded", "false");
      elementos.userDropdown.classList.remove("active");
    }
  });
}

function configurarLogout() {
  if (!elementos.logoutBtn) return;

  elementos.logoutBtn.addEventListener("click", async () => {
    elementos.logoutBtn.disabled = true;

    try {
      const resposta = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });

      if (!resposta.ok) {
        throw new Error("Não foi possível encerrar a sessão.");
      }

      window.location.href = "/admin/admin-login.html";
    } catch (erro) {
      console.error("Erro ao sair:", erro);
      alert(erro.message);
      elementos.logoutBtn.disabled = false;
    }
  });
}

function configurarMenuMobile() {
  if (!elementos.navToggle || !elementos.adminNav) return;

  elementos.navToggle.addEventListener("click", () => {
    const aberto = elementos.navToggle.getAttribute("aria-expanded") === "true";

    elementos.navToggle.setAttribute("aria-expanded", String(!aberto));
    elementos.adminNav.classList.toggle("active", !aberto);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  configurarMenuUsuario();
  configurarLogout();
  configurarMenuMobile();

  carregarUsuario();
  carregarDashboard();
});
