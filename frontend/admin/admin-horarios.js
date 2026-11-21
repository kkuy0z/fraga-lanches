"use strict";

document.addEventListener("DOMContentLoaded", () => {
  // ======================================================
  // CONFIGURAÇÕES
  // ======================================================

  const API = "/api/admin/horarios";
  const API_AUTH = "/api/auth";

  const DIAS_SEMANA = [
    "Domingo",
    "Segunda-feira",
    "Terça-feira",
    "Quarta-feira",
    "Quinta-feira",
    "Sexta-feira",
    "Sábado",
  ];

  // ======================================================
  // ELEMENTOS
  // ======================================================

  const tbodyHorarios = document.getElementById("tbodyHorarios");
  const emptyState = document.getElementById("emptyState");

  const btnNovoHorario = document.getElementById("btnNovoHorario");
  const btnPrimeiroHorario = document.getElementById("btnPrimeiroHorario");

  const horarioModal = document.getElementById("horarioModal");
  const horarioModalTitulo = document.getElementById("horarioModalTitulo");
  const horarioForm = document.getElementById("horarioForm");

  const horarioId = document.getElementById("horarioId");
  const horarioDiaSemana = document.getElementById("horarioDiaSemana");
  const horarioAbre = document.getElementById("horarioAbre");
  const horarioFecha = document.getElementById("horarioFecha");
  const horarioFechado = document.getElementById("horarioFechado");

  const horarioModalClose = document.getElementById("horarioModalClose");
  const btnCancelarHorario = document.getElementById("btnCancelarHorario");
  const btnSalvarHorario = document.getElementById("btnSalvarHorario");

  const deleteHorarioModal = document.getElementById("deleteHorarioModal");
  const deleteHorarioDia = document.getElementById("deleteHorarioDia");

  const btnCancelarDeleteHorario = document.getElementById(
    "btnCancelarDeleteHorario",
  );

  const btnConfirmarDeleteHorario = document.getElementById(
    "btnConfirmarDeleteHorario",
  );

  const statusIndicator = document.getElementById("statusIndicator");
  const statusText = document.getElementById("statusText");

  const adminNav = document.getElementById("adminNav");
  const adminNavToggle = document.getElementById("adminNavToggle");

  const userButton = document.getElementById("userButton");
  const userDropdown = document.getElementById("userDropdown");
  const userMenu = document.getElementById("userMenu");
  const logoutBtn = document.getElementById("logoutBtn");

  const userName = document.getElementById("userName");
  const userAvatar = document.getElementById("userAvatar");
  const dropdownUserName = document.getElementById("dropdownUserName");
  const dropdownUserRole = document.getElementById("dropdownUserRole");

  // ======================================================
  // ESTADO
  // ======================================================

  let horarios = [];
  let horarioParaExcluir = null;

  // ======================================================
  // UTILITÁRIOS
  // ======================================================

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

  function formatarHorario(horario) {
    if (!horario) return "--:--";
    return String(horario).substring(0, 5);
  }

  function horarioEstaFechado(horario) {
    return (
      horario.ativo === false || horario.ativo === 0 || horario.ativo === "0"
    );
  }

  function mostrarMensagem(mensagem) {
    window.alert(mensagem);
  }

  async function requisicao(url, opcoes = {}) {
    const resposta = await fetch(url, {
      ...opcoes,
      credentials: "same-origin",
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
      mostrarMensagem(
        dados.mensagem || "Sua sessão expirou ou você não tem permissão.",
      );

      window.location.href = "/";
      throw new Error("Acesso não autorizado.");
    }

    if (!resposta.ok) {
      throw new Error(
        dados.mensagem || "Não foi possível concluir a operação.",
      );
    }

    return dados;
  }

  // ======================================================
  // AUTENTICAÇÃO E USUÁRIO
  // ======================================================

  async function carregarUsuario() {
    try {
      const dados = await requisicao(`${API_AUTH}/me`);

      const usuario = dados.usuario || dados.user || dados;

      if (usuario && usuario.tipo && usuario.tipo !== "admin") {
        mostrarMensagem("Acesso permitido somente para administradores.");
        window.location.href = "/";
        return;
      }

      if (usuario && usuario.nome) {
        const nome = usuario.nome;

        if (userName) userName.textContent = nome;
        if (dropdownUserName) dropdownUserName.textContent = nome;

        if (userAvatar) {
          userAvatar.textContent = nome.trim().charAt(0).toUpperCase();
        }
      }

      if (dropdownUserRole) {
        dropdownUserRole.textContent = "Administrador";
      }
    } catch (erro) {
      console.error("[HORÁRIOS] Erro ao verificar usuário:", erro);
    }
  }

  async function sair() {
    if (logoutBtn) logoutBtn.disabled = true;

    try {
      await requisicao(`${API_AUTH}/logout`, {
        method: "POST",
      });
    } catch (erro) {
      console.error("[HORÁRIOS] Erro ao encerrar sessão:", erro);
    } finally {
      window.location.href = "/";
    }
  }

  // ======================================================
  // MODAIS — COMPATÍVEL COM DESIGN SYSTEM
  // ======================================================

  function abrirModalHorario(horario = null) {
    horarioForm.reset();

    if (horario) {
      horarioModalTitulo.textContent = "Editar Horário";

      horarioId.value = horario.id;
      horarioDiaSemana.value = String(horario.dia_semana);

      const fechado = horarioEstaFechado(horario);

      horarioFechado.checked = fechado;

      horarioAbre.value = fechado
        ? ""
        : formatarHorario(horario.horario_abertura);

      horarioFecha.value = fechado
        ? ""
        : formatarHorario(horario.horario_fechamento);
    } else {
      horarioModalTitulo.textContent = "Novo Horário";
      horarioId.value = "";
      horarioDiaSemana.value = "";
      horarioFechado.checked = false;
    }

    atualizarCamposHorario();

    horarioModal.classList.add("show");
    document.body.style.overflow = "hidden";
  }

  function fecharModalHorario() {
    horarioModal.classList.remove("show");

    horarioForm.reset();
    horarioId.value = "";

    atualizarCamposHorario();

    if (!deleteHorarioModal.classList.contains("show")) {
      document.body.style.overflow = "";
    }
  }

  function abrirModalExclusao(horario) {
    horarioParaExcluir = horario;

    deleteHorarioDia.textContent = DIAS_SEMANA[horario.dia_semana];

    deleteHorarioModal.classList.add("show");
    document.body.style.overflow = "hidden";
  }

  function fecharModalExclusao() {
    deleteHorarioModal.classList.remove("show");

    horarioParaExcluir = null;

    if (!horarioModal.classList.contains("show")) {
      document.body.style.overflow = "";
    }
  }

  // ======================================================
  // CAMPOS DO FORMULÁRIO
  // ======================================================

  function atualizarCamposHorario() {
    const fechado = horarioFechado.checked;

    horarioAbre.disabled = fechado;
    horarioFecha.disabled = fechado;

    horarioAbre.required = !fechado;
    horarioFecha.required = !fechado;

    if (fechado) {
      horarioAbre.value = "";
      horarioFecha.value = "";
    }
  }

  // ======================================================
  // LISTAGEM
  // ======================================================

  async function carregarHorarios() {
    try {
      tbodyHorarios.innerHTML = `
        <tr>
          <td colspan="5" class="text-center py-4">
            Carregando horários...
          </td>
        </tr>
      `;

      const dados = await requisicao(API);

      horarios = Array.isArray(dados) ? dados : [];

      renderizarHorarios();
      atualizarStatusEstabelecimento();
    } catch (erro) {
      console.error("[HORÁRIOS] Erro ao carregar:", erro);

      tbodyHorarios.innerHTML = `
        <tr>
          <td colspan="5" class="text-center py-4">
            Não foi possível carregar os horários.
          </td>
        </tr>
      `;

      mostrarMensagem(erro.message);
    }
  }

  function renderizarHorarios() {
    if (!horarios.length) {
      tbodyHorarios.innerHTML = `
        <tr>
          <td colspan="5" class="text-center py-4">
            Nenhum horário cadastrado.
          </td>
        </tr>
      `;

      emptyState.classList.remove("hidden");
      return;
    }

    emptyState.classList.add("hidden");

    const ordenados = [...horarios].sort(
      (a, b) => Number(a.dia_semana) - Number(b.dia_semana),
    );

    tbodyHorarios.innerHTML = ordenados
      .map((horario) => {
        const fechado = horarioEstaFechado(horario);
        const dia = DIAS_SEMANA[Number(horario.dia_semana)];

        const abertura = fechado
          ? "--:--"
          : formatarHorario(horario.horario_abertura);

        const fechamento = fechado
          ? "--:--"
          : formatarHorario(horario.horario_fechamento);

        const statusHTML = fechado
          ? `<span class="badge" style="background:rgba(248,113,113,.14);color:#fca5a5;border:1px solid rgba(248,113,113,.35)">Fechado</span>`
          : `<span class="badge" style="background:rgba(74,222,128,.12);color:#86efac;border:1px solid rgba(74,222,128,.3)">Aberto</span>`;

        return `
          <tr>
            <td><strong>${escaparHTML(dia)}</strong></td>
            <td>${abertura}</td>
            <td>${fechamento}</td>
            <td>${statusHTML}</td>
            <td>
              <div style="display:flex;gap:8px;flex-wrap:wrap">
                <button
                  type="button"
                  class="btn btn-secondary"
                  data-acao="editar"
                  data-id="${Number(horario.id)}"
                  aria-label="Editar ${escaparHTML(dia)}"
                >
                  Editar
                </button>

                <button
                  type="button"
                  class="btn btn-danger"
                  data-acao="excluir"
                  data-id="${Number(horario.id)}"
                  aria-label="Excluir ${escaparHTML(dia)}"
                >
                  Excluir
                </button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  // ======================================================
  // SALVAR HORÁRIO
  // ======================================================

  async function salvarHorario(evento) {
    evento.preventDefault();

    const id = horarioId.value;
    const fechado = horarioFechado.checked;

    const payload = {
      dia_semana: Number(horarioDiaSemana.value),
      horario_abertura: fechado ? null : horarioAbre.value,
      horario_fechamento: fechado ? null : horarioFecha.value,
      fechado,
    };

    if (!horarioDiaSemana.value) {
      mostrarMensagem("Selecione o dia da semana.");
      horarioDiaSemana.focus();
      return;
    }

    if (
      !fechado &&
      (!payload.horario_abertura || !payload.horario_fechamento)
    ) {
      mostrarMensagem("Informe os horários de abertura e fechamento.");
      return;
    }

    if (!fechado && payload.horario_abertura === payload.horario_fechamento) {
      mostrarMensagem("A abertura e o fechamento não podem ser iguais.");
      return;
    }

    const metodo = id ? "PUT" : "POST";
    const url = id ? `${API}/${encodeURIComponent(id)}` : API;

    btnSalvarHorario.disabled = true;
    btnSalvarHorario.textContent = "Salvando...";

    try {
      const resposta = await requisicao(url, {
        method: metodo,
        body: JSON.stringify(payload),
      });

      fecharModalHorario();
      await carregarHorarios();

      mostrarMensagem(resposta.mensagem || "Horário salvo com sucesso.");
    } catch (erro) {
      console.error("[HORÁRIOS] Erro ao salvar:", erro);
      mostrarMensagem(erro.message);
    } finally {
      btnSalvarHorario.disabled = false;
      btnSalvarHorario.innerHTML = `
        <svg class="btn-icon" aria-hidden="true">
          <use href="#i-save"></use>
        </svg>
        Salvar Horário
      `;
    }
  }

  // ======================================================
  // EDITAR E EXCLUIR
  // ======================================================

  function localizarHorario(id) {
    return horarios.find((horario) => Number(horario.id) === Number(id));
  }

  async function excluirHorario() {
    if (!horarioParaExcluir) return;

    const id = horarioParaExcluir.id;

    btnConfirmarDeleteHorario.disabled = true;
    btnConfirmarDeleteHorario.textContent = "Excluindo...";

    try {
      const resposta = await requisicao(`${API}/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });

      fecharModalExclusao();
      await carregarHorarios();

      mostrarMensagem(resposta.mensagem || "Horário excluído com sucesso.");
    } catch (erro) {
      console.error("[HORÁRIOS] Erro ao excluir:", erro);
      mostrarMensagem(erro.message);
    } finally {
      btnConfirmarDeleteHorario.disabled = false;
      btnConfirmarDeleteHorario.innerHTML = `
        <svg class="btn-icon" aria-hidden="true">
          <use href="#i-trash"></use>
        </svg>
        Excluir
      `;
    }
  }

  // ======================================================
  // STATUS DO ESTABELECIMENTO
  // ======================================================

  function converterParaMinutos(horario) {
    const partes = formatarHorario(horario).split(":");

    if (partes.length !== 2) return null;

    const horas = Number(partes[0]);
    const minutos = Number(partes[1]);

    if (
      !Number.isInteger(horas) ||
      !Number.isInteger(minutos) ||
      horas < 0 ||
      horas > 23 ||
      minutos < 0 ||
      minutos > 59
    ) {
      return null;
    }

    return horas * 60 + minutos;
  }

  function estabelecimentoEstaAberto() {
    const agora = new Date();

    const diaAtual = agora.getDay();
    const minutosAgora = agora.getHours() * 60 + agora.getMinutes();
    const diaAnterior = (diaAtual + 6) % 7;

    const horarioHoje = horarios.find(
      (item) => Number(item.dia_semana) === diaAtual,
    );

    const horarioOntem = horarios.find(
      (item) => Number(item.dia_semana) === diaAnterior,
    );

    // Verifica se o horário de ontem atravessa a meia-noite.
    if (horarioOntem && !horarioEstaFechado(horarioOntem)) {
      const inicioOntem = converterParaMinutos(horarioOntem.horario_abertura);

      const fimOntem = converterParaMinutos(horarioOntem.horario_fechamento);

      if (
        inicioOntem !== null &&
        fimOntem !== null &&
        fimOntem < inicioOntem &&
        minutosAgora < fimOntem
      ) {
        return true;
      }
    }

    if (!horarioHoje || horarioEstaFechado(horarioHoje)) {
      return false;
    }

    const abertura = converterParaMinutos(horarioHoje.horario_abertura);

    const fechamento = converterParaMinutos(horarioHoje.horario_fechamento);

    if (abertura === null || fechamento === null) {
      return false;
    }

    if (fechamento > abertura) {
      return minutosAgora >= abertura && minutosAgora < fechamento;
    }

    // Horário que atravessa a meia-noite.
    return minutosAgora >= abertura;
  }

  function atualizarStatusEstabelecimento() {
    if (!statusIndicator || !statusText) return;

    if (!horarios.length) {
      statusText.textContent = "Sem horários configurados";
      statusIndicator.style.backgroundColor = "#a5a5a5";
      return;
    }

    const aberto = estabelecimentoEstaAberto();

    if (aberto) {
      statusText.textContent = "Estabelecimento aberto";
      statusIndicator.style.backgroundColor = "#4ade80";
    } else {
      statusText.textContent = "Estabelecimento fechado";
      statusIndicator.style.backgroundColor = "#f87171";
    }
  }

  // ======================================================
  // MENU ADMINISTRATIVO
  // ======================================================

  function configurarMenu() {
    if (adminNavToggle && adminNav) {
      adminNavToggle.addEventListener("click", () => {
        const aberto = adminNav.classList.toggle("open");

        adminNavToggle.setAttribute("aria-expanded", String(aberto));
      });
    }

    if (userButton && userDropdown) {
      userButton.addEventListener("click", (evento) => {
        evento.stopPropagation();

        const aberto = userDropdown.classList.toggle("open");

        userButton.setAttribute("aria-expanded", String(aberto));
      });
    }

    document.addEventListener("click", (evento) => {
      if (userMenu && userDropdown && !userMenu.contains(evento.target)) {
        userDropdown.classList.remove("open");
        userButton?.setAttribute("aria-expanded", "false");
      }

      if (
        adminNav &&
        adminNavToggle &&
        !adminNav.contains(evento.target) &&
        !adminNavToggle.contains(evento.target)
      ) {
        adminNav.classList.remove("open");
        adminNavToggle.setAttribute("aria-expanded", "false");
      }
    });

    if (logoutBtn) {
      logoutBtn.addEventListener("click", sair);
    }
  }

  // ======================================================
  // EVENTOS
  // ======================================================

  function registrarEventos() {
    btnNovoHorario?.addEventListener("click", () => {
      abrirModalHorario();
    });

    btnPrimeiroHorario?.addEventListener("click", () => {
      abrirModalHorario();
    });

    horarioModalClose?.addEventListener("click", fecharModalHorario);
    btnCancelarHorario?.addEventListener("click", fecharModalHorario);

    horarioForm?.addEventListener("submit", salvarHorario);

    horarioFechado?.addEventListener("change", atualizarCamposHorario);

    tbodyHorarios?.addEventListener("click", (evento) => {
      const botao = evento.target.closest("button[data-acao]");

      if (!botao) return;

      const id = Number(botao.dataset.id);
      const acao = botao.dataset.acao;
      const horario = localizarHorario(id);

      if (!horario) {
        mostrarMensagem("Horário não encontrado. Atualize a página.");
        return;
      }

      if (acao === "editar") {
        abrirModalHorario(horario);
      }

      if (acao === "excluir") {
        abrirModalExclusao(horario);
      }
    });

    btnCancelarDeleteHorario?.addEventListener("click", fecharModalExclusao);

    btnConfirmarDeleteHorario?.addEventListener("click", excluirHorario);

    [horarioModal, deleteHorarioModal].forEach((modal) => {
      modal?.addEventListener("click", (evento) => {
        if (evento.target !== modal) return;

        if (modal === horarioModal) {
          fecharModalHorario();
        } else {
          fecharModalExclusao();
        }
      });
    });

    document.addEventListener("keydown", (evento) => {
      if (evento.key !== "Escape") return;

      if (horarioModal.classList.contains("show")) {
        fecharModalHorario();
      }

      if (deleteHorarioModal.classList.contains("show")) {
        fecharModalExclusao();
      }
    });
  }

  // ======================================================
  // INICIALIZAÇÃO
  // ======================================================

  async function iniciar() {
    configurarMenu();
    registrarEventos();

    await carregarUsuario();
    await carregarHorarios();

    // Atualiza o status sem precisar recarregar a página.
    window.setInterval(atualizarStatusEstabelecimento, 30000);
  }

  iniciar();
});
