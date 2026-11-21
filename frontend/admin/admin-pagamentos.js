"use strict";

document.addEventListener("DOMContentLoaded", () => {
  // ======================================================
  // CONFIGURAÇÕES
  // ======================================================

  const API = "/api/admin/pagamentos";
  const API_AUTH = "/api/auth";

  const TIPOS = ["dinheiro", "credito", "debito", "pix", "boleto", "outro"];

  let formasPagamento = [];
  let formaSelecionada = null;

  // ======================================================
  // ELEMENTOS
  // ======================================================

  const elementos = {
    // Navegação
    adminNav: document.getElementById("adminNav"),
    adminNavToggle: document.getElementById("adminNavToggle"),
    userMenu: document.getElementById("userMenu"),
    userButton: document.getElementById("userButton"),
    userDropdown: document.getElementById("userDropdown"),
    logoutBtn: document.getElementById("logoutBtn"),
    userName: document.getElementById("userName"),
    userAvatar: document.getElementById("userAvatar"),
    dropdownUserName: document.getElementById("dropdownUserName"),
    dropdownUserRole: document.getElementById("dropdownUserRole"),

    // Ações
    btnNovaFormaPagamento: document.getElementById("btnNovaFormaPagamento"),
    btnPrimeiraFormaPagamento: document.getElementById(
      "btnPrimeiraFormaPagamento",
    ),

    // Pesquisa
    buscaPagamento: document.getElementById("buscaPagamento"),
    filtroAtivoPagamento: document.getElementById("filtroAtivoPagamento"),

    // Tabela
    tabelaPagamentos: document.getElementById("tabelaPagamentos"),
    tbodyPagamentos: document.getElementById("tbodyPagamentos"),
    emptyState: document.getElementById("emptyState"),
    pagination: document.getElementById("pagination"),

    // Modal
    pagamentoModal: document.getElementById("pagamentoModal"),
    pagamentoModalTitulo: document.getElementById("pagamentoModalTitulo"),
    pagamentoForm: document.getElementById("pagamentoForm"),
    pagamentoId: document.getElementById("pagamentoId"),
    pagamentoNome: document.getElementById("pagamentoNome"),
    pagamentoTipo: document.getElementById("pagamentoTipo"),
    pagamentoTaxa: document.getElementById("pagamentoTaxa"),
    pagamentoPrazo: document.getElementById("pagamentoPrazo"),
    pagamentoOrdem: document.getElementById("pagamentoOrdem"),
    pagamentoAtivo: document.getElementById("pagamentoAtivo"),
    pagamentoOnline: document.getElementById("pagamentoOnline"),
    pagamentoModalClose: document.getElementById("pagamentoModalClose"),
    btnCancelarPagamento: document.getElementById("btnCancelarPagamento"),
    btnSalvarPagamento: document.getElementById("btnSalvarPagamento"),

    // Exclusão
    deletePagamentoModal: document.getElementById("deletePagamentoModal"),
    deletePagamentoNome: document.getElementById("deletePagamentoNome"),
    btnCancelarDeletePagamento: document.getElementById(
      "btnCancelarDeletePagamento",
    ),
    btnConfirmarDeletePagamento: document.getElementById(
      "btnConfirmarDeletePagamento",
    ),
  };

  // ======================================================
  // UTILITÁRIOS
  // ======================================================

  function mostrarMensagem(mensagem, tipo = "success") {
    if (typeof window.showToast === "function") {
      window.showToast(mensagem, tipo);
      return;
    }

    const toast = document.createElement("div");

    toast.textContent = mensagem;
    toast.setAttribute("role", "status");

    Object.assign(toast.style, {
      position: "fixed",
      right: "20px",
      bottom: "20px",
      zIndex: "99999",
      padding: "14px 18px",
      borderRadius: "8px",
      color: "#fff",
      background: tipo === "error" ? "#b42318" : "#15803d",
      boxShadow: "0 5px 20px rgba(0,0,0,.25)",
      maxWidth: "min(400px, calc(100vw - 40px))",
    });

    document.body.appendChild(toast);

    setTimeout(() => toast.remove(), 3500);
  }

  async function requisicao(url, opcoes = {}) {
    const resposta = await fetch(url, {
      credentials: "include",
      ...opcoes,
      headers: {
        ...(opcoes.body ? { "Content-Type": "application/json" } : {}),
        ...opcoes.headers,
      },
    });

    let dados = {};

    try {
      dados = await resposta.json();
    } catch {
      dados = {};
    }

    if (resposta.status === 401 || resposta.status === 403) {
      window.location.href = "/login.html";
      throw new Error("Sessão inválida ou sem permissão.");
    }

    if (!resposta.ok) {
      throw new Error(
        dados.mensagem || "Não foi possível concluir a operação.",
      );
    }

    return dados;
  }

  function escaparHTML(valor) {
    return String(valor ?? "").replace(/[&<>"']/g, (caractere) => {
      const mapa = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      };

      return mapa[caractere];
    });
  }

  function formatarMoeda(valor) {
    return Number(valor || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function formatarTipo(tipo) {
    const nomes = {
      dinheiro: "Dinheiro",
      credito: "Crédito",
      debito: "Débito",
      pix: "PIX",
      boleto: "Boleto",
      outro: "Outro",
    };

    return nomes[tipo] || tipo;
  }

  function obterStatus(ativo) {
    return Number(ativo) === 1 || ativo === true;
  }

  // ======================================================
  // AUTENTICAÇÃO
  // ======================================================

  async function verificarAutenticacao() {
    const dados = await requisicao(`${API_AUTH}/me`);

    const usuario = dados.usuario || dados;

    const nome =
      usuario.nome || usuario.nome_completo || usuario.email || "Administrador";

    const papel = usuario.tipo || usuario.papel || "Administrador";

    if (elementos.userName) {
      elementos.userName.textContent = nome;
    }

    if (elementos.dropdownUserName) {
      elementos.dropdownUserName.textContent = nome;
    }

    if (elementos.dropdownUserRole) {
      elementos.dropdownUserRole.textContent = papel;
    }

    if (elementos.userAvatar) {
      elementos.userAvatar.textContent = nome.trim().charAt(0).toUpperCase();
    }
  }

  async function fazerLogout() {
    try {
      await fetch(`${API_AUTH}/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (erro) {
      console.error("Erro ao encerrar sessão:", erro);
    }

    window.location.href = "/login.html";
  }

  // ======================================================
  // NAVEGAÇÃO
  // ======================================================

  function configurarNavegacao() {
    elementos.adminNavToggle?.addEventListener("click", () => {
      elementos.adminNav?.classList.toggle("show");
    });

    elementos.userButton?.addEventListener("click", (evento) => {
      evento.stopPropagation();
      elementos.userDropdown?.classList.toggle("show");
    });

    document.addEventListener("click", (evento) => {
      if (elementos.userMenu && !elementos.userMenu.contains(evento.target)) {
        elementos.userDropdown?.classList.remove("show");
      }
    });

    elementos.logoutBtn?.addEventListener("click", fazerLogout);
  }

  // ======================================================
  // MODAIS
  // ======================================================

  function abrirModal(modal) {
    if (!modal) return;

    modal.classList.add("show");
    modal.setAttribute("aria-hidden", "false");
  }

  function fecharModal(modal) {
    if (!modal) return;

    modal.classList.remove("show");
    modal.setAttribute("aria-hidden", "true");
  }

  function fecharTodosModais() {
    fecharModal(elementos.pagamentoModal);
    fecharModal(elementos.deletePagamentoModal);
  }

  // ======================================================
  // FORMULÁRIO
  // ======================================================

  function limparFormulario() {
    elementos.pagamentoForm?.reset();

    if (elementos.pagamentoId) {
      elementos.pagamentoId.value = "";
    }

    if (elementos.pagamentoAtivo) {
      elementos.pagamentoAtivo.checked = true;
    }

    if (elementos.pagamentoOnline) {
      elementos.pagamentoOnline.checked = false;
    }

    if (elementos.pagamentoTaxa) {
      elementos.pagamentoTaxa.value = "0";
    }

    if (elementos.pagamentoPrazo) {
      elementos.pagamentoPrazo.value = "0";
    }

    if (elementos.pagamentoOrdem) {
      elementos.pagamentoOrdem.value = "0";
    }
  }

  function abrirNovoPagamento() {
    formaSelecionada = null;

    limparFormulario();

    if (elementos.pagamentoModalTitulo) {
      elementos.pagamentoModalTitulo.textContent = "Nova forma de pagamento";
    }

    abrirModal(elementos.pagamentoModal);
  }

  function editarPagamento(id) {
    const forma = formasPagamento.find(
      (item) => Number(item.id) === Number(id),
    );

    if (!forma) {
      mostrarMensagem("Forma de pagamento não encontrada.", "error");
      return;
    }

    formaSelecionada = forma;

    elementos.pagamentoId.value = forma.id;
    elementos.pagamentoNome.value = forma.nome;
    elementos.pagamentoTipo.value = forma.tipo;
    elementos.pagamentoTaxa.value = forma.taxa_percentual;
    elementos.pagamentoPrazo.value = forma.prazo_recebimento;
    elementos.pagamentoOrdem.value = forma.ordem_exibicao;
    elementos.pagamentoAtivo.checked = obterStatus(forma.ativo);
    elementos.pagamentoOnline.checked = obterStatus(forma.online);

    if (elementos.pagamentoModalTitulo) {
      elementos.pagamentoModalTitulo.textContent = "Editar forma de pagamento";
    }

    abrirModal(elementos.pagamentoModal);
  }

  function obterDadosFormulario() {
    return {
      nome: elementos.pagamentoNome.value.trim(),
      tipo: elementos.pagamentoTipo.value,
      taxa_percentual: Number(elementos.pagamentoTaxa.value || 0),
      prazo_recebimento: Number(elementos.pagamentoPrazo.value || 0),
      ordem_exibicao: Number(elementos.pagamentoOrdem.value || 0),
      ativo: elementos.pagamentoAtivo.checked,
      online: elementos.pagamentoOnline.checked,
    };
  }

  function validarFormulario(dados) {
    if (!dados.nome) {
      throw new Error("Informe o nome da forma de pagamento.");
    }

    if (dados.nome.length > 50) {
      throw new Error("O nome deve ter no máximo 50 caracteres.");
    }

    if (!TIPOS.includes(dados.tipo)) {
      throw new Error("Selecione um tipo de pagamento válido.");
    }

    if (
      !Number.isFinite(dados.taxa_percentual) ||
      dados.taxa_percentual < 0 ||
      dados.taxa_percentual > 100
    ) {
      throw new Error("Informe uma taxa entre 0 e 100.");
    }

    if (
      !Number.isInteger(dados.prazo_recebimento) ||
      dados.prazo_recebimento < 0
    ) {
      throw new Error("Informe um prazo de recebimento válido.");
    }

    if (!Number.isInteger(dados.ordem_exibicao)) {
      throw new Error("Informe uma ordem de exibição válida.");
    }
  }

  async function salvarPagamento(evento) {
    evento.preventDefault();

    const id = elementos.pagamentoId.value;
    const dados = obterDadosFormulario();

    try {
      validarFormulario(dados);

      elementos.btnSalvarPagamento.disabled = true;
      elementos.btnSalvarPagamento.textContent = "Salvando...";

      const url = id ? `${API}/${id}` : API;
      const metodo = id ? "PUT" : "POST";

      const resultado = await requisicao(url, {
        method: metodo,
        body: JSON.stringify(dados),
      });

      fecharModal(elementos.pagamentoModal);

      mostrarMensagem(resultado.mensagem || "Operação realizada com sucesso.");

      await carregarFormasPagamento();
    } catch (erro) {
      mostrarMensagem(erro.message, "error");
    } finally {
      elementos.btnSalvarPagamento.disabled = false;
      elementos.btnSalvarPagamento.textContent = "Salvar";
    }
  }

  // ======================================================
  // EXCLUSÃO
  // ======================================================

  function confirmarExclusao(id) {
    const forma = formasPagamento.find(
      (item) => Number(item.id) === Number(id),
    );

    if (!forma) return;

    formaSelecionada = forma;

    if (elementos.deletePagamentoNome) {
      elementos.deletePagamentoNome.textContent = forma.nome;
    }

    abrirModal(elementos.deletePagamentoModal);
  }

  async function excluirPagamento() {
    if (!formaSelecionada) return;

    try {
      elementos.btnConfirmarDeletePagamento.disabled = true;

      const resultado = await requisicao(`${API}/${formaSelecionada.id}`, {
        method: "DELETE",
      });

      fecharModal(elementos.deletePagamentoModal);

      mostrarMensagem(resultado.mensagem || "Forma excluída com sucesso.");

      formaSelecionada = null;

      await carregarFormasPagamento();
    } catch (erro) {
      mostrarMensagem(erro.message, "error");
    } finally {
      elementos.btnConfirmarDeletePagamento.disabled = false;
    }
  }

  // ======================================================
  // TABELA
  // ======================================================

  function criarLinha(forma) {
    const ativo = obterStatus(forma.ativo);
    const online = obterStatus(forma.online);

    return `
      <tr>
        <td>
          <strong>${escaparHTML(forma.nome)}</strong>
        </td>

        <td>
          ${escaparHTML(formatarTipo(forma.tipo))}
        </td>

        <td>
          ${formatarMoeda(forma.taxa_percentual)}%
        </td>

        <td>
          ${Number(forma.prazo_recebimento)} dia(s)
        </td>

        <td>
          <span class="status-badge ${ativo ? "status-active" : "status-inactive"}">
            ${ativo ? "Ativo" : "Inativo"}
          </span>
        </td>

        <td>
          <span class="status-badge ${online ? "status-active" : "status-inactive"}">
            ${online ? "Sim" : "Não"}
          </span>
        </td>

        <td>
          <div class="table-actions">
            <button
              type="button"
              class="btn-icon btn-edit"
              data-acao="editar"
              data-id="${Number(forma.id)}"
              title="Editar"
              aria-label="Editar ${escaparHTML(forma.nome)}"
            >
              <i class="fas fa-edit"></i>
            </button>

            <button
              type="button"
              class="btn-icon btn-delete"
              data-acao="excluir"
              data-id="${Number(forma.id)}"
              title="Excluir"
              aria-label="Excluir ${escaparHTML(forma.nome)}"
            >
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }

  function renderizarTabela(lista) {
    if (!elementos.tbodyPagamentos) return;

    elementos.tbodyPagamentos.innerHTML = lista.map(criarLinha).join("");

    const possuiDados = lista.length > 0;

    if (elementos.emptyState) {
      elementos.emptyState.style.display = possuiDados ? "none" : "";
    }

    if (elementos.tabelaPagamentos) {
      elementos.tabelaPagamentos.style.display = possuiDados ? "" : "none";
    }

    if (elementos.pagination) {
      elementos.pagination.style.display = "none";
    }

    if (elementos.btnPrimeiraFormaPagamento) {
      elementos.btnPrimeiraFormaPagamento.style.display = possuiDados
        ? "none"
        : "";
    }
  }

  function filtrarFormasPagamento() {
    const busca = elementos.buscaPagamento?.value.trim().toLowerCase() || "";

    const filtro = elementos.filtroAtivoPagamento?.value ?? "";

    const filtradas = formasPagamento.filter((forma) => {
      const correspondeBusca =
        forma.nome.toLowerCase().includes(busca) ||
        formatarTipo(forma.tipo).toLowerCase().includes(busca);

      const correspondeStatus =
        filtro === "" || Number(forma.ativo) === Number(filtro);

      return correspondeBusca && correspondeStatus;
    });

    renderizarTabela(filtradas);
  }

  async function carregarFormasPagamento() {
    try {
      const dados = await requisicao(API);

      formasPagamento = Array.isArray(dados.formasPagamento)
        ? dados.formasPagamento
        : [];

      filtrarFormasPagamento();
    } catch (erro) {
      console.error("Erro ao carregar formas de pagamento:", erro);

      mostrarMensagem(erro.message, "error");
    }
  }

  // ======================================================
  // EVENTOS
  // ======================================================

  function configurarEventos() {
    elementos.btnNovaFormaPagamento?.addEventListener(
      "click",
      abrirNovoPagamento,
    );

    elementos.btnPrimeiraFormaPagamento?.addEventListener(
      "click",
      abrirNovoPagamento,
    );

    elementos.pagamentoForm?.addEventListener("submit", salvarPagamento);

    elementos.pagamentoModalClose?.addEventListener("click", () => {
      fecharModal(elementos.pagamentoModal);
    });

    elementos.btnCancelarPagamento?.addEventListener("click", () => {
      fecharModal(elementos.pagamentoModal);
    });

    elementos.btnCancelarDeletePagamento?.addEventListener("click", () => {
      fecharModal(elementos.deletePagamentoModal);
      formaSelecionada = null;
    });

    elementos.btnConfirmarDeletePagamento?.addEventListener(
      "click",
      excluirPagamento,
    );

    elementos.buscaPagamento?.addEventListener("input", filtrarFormasPagamento);

    elementos.filtroAtivoPagamento?.addEventListener(
      "change",
      filtrarFormasPagamento,
    );

    elementos.tbodyPagamentos?.addEventListener("click", (evento) => {
      const botao = evento.target.closest("[data-acao]");

      if (!botao) return;

      const id = Number(botao.dataset.id);

      if (botao.dataset.acao === "editar") {
        editarPagamento(id);
      }

      if (botao.dataset.acao === "excluir") {
        confirmarExclusao(id);
      }
    });

    [elementos.pagamentoModal, elementos.deletePagamentoModal].forEach(
      (modal) => {
        modal?.addEventListener("click", (evento) => {
          if (evento.target === modal) {
            fecharModal(modal);
          }
        });
      },
    );

    document.addEventListener("keydown", (evento) => {
      if (evento.key === "Escape") {
        fecharTodosModais();
      }
    });
  }

  // ======================================================
  // INICIALIZAÇÃO
  // ======================================================

  async function iniciar() {
    console.log("[ADMIN PAGAMENTOS] Inicializando...");

    configurarNavegacao();
    configurarEventos();

    try {
      await verificarAutenticacao();
      await carregarFormasPagamento();

      console.log("[ADMIN PAGAMENTOS] Inicializado com sucesso.");
    } catch (erro) {
      console.error("[ADMIN PAGAMENTOS]", erro);
      mostrarMensagem(erro.message, "error");
    }
  }

  iniciar();
});
