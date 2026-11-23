"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const API = "/api/admin/usuarios";
  const API_AUTH = "/api/auth";
  const LOGIN = "/admin/admin-login.html";
  const PERFIS = {
    admin: "Administrador",
    atendente: "Atendente",
    cozinha: "Cozinha",
    entregador: "Entregador",
  };

  const $ = (id) => document.getElementById(id);
  const el = {
    tbody: $("tbodyUsuarios"),
    busca: $("buscaUsuario"),
    perfil: $("filtroPerfil"),
    ativo: $("filtroAtivoUsuario"),
    empty: $("emptyState"),
    pagination: $("pagination"),
    modal: $("usuarioModal"),
    modalTitulo: $("usuarioModalTitulo"),
    form: $("usuarioForm"),
    id: $("usuarioId"),
    nome: $("usuarioNome"),
    email: $("usuarioEmail"),
    senha: $("usuarioSenha"),
    confirmar: $("usuarioConfirmarSenha"),
    senhaGroup: $("senhaGroup"),
    confirmarGroup: $("confirmarSenhaGroup"),
    perfilForm: $("usuarioPerfil"),
    ativoForm: $("usuarioAtivo"),
    btnNovo: $("btnNovoUsuario"),
    btnPrimeiro: $("btnPrimeiroUsuario"),
    btnSalvar: $("btnSalvarUsuario"),
    btnCancelar: $("btnCancelarUsuario"),
    btnFechar: $("usuarioModalClose"),
    toggleSenha: $("toggleUsuarioSenha"),
    toggleConfirmar: $("toggleConfirmarSenha"),
    userName: $("userName"),
    avatar: $("userAvatar"),
    dropdownName: $("dropdownUserName"),
    dropdownRole: $("dropdownUserRole"),
    userButton: $("userButton"),
    dropdown: $("userDropdown"),
    userMenu: $("userMenu"),
    logout: $("logoutBtn"),
    navToggle: $("adminNavToggle"),
    nav: $("adminNav"),
  };

  let usuarios = [];
  let temporizadorBusca = null;
  let salvando = false;

  function escapar(valor) {
    return String(valor ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
    })[c]);
  }

  function mensagem(texto, tipo = "success") {
    if (typeof window.showToast === "function") {
      window.showToast(texto, tipo);
      return;
    }
    const toast = document.createElement("div");
    toast.textContent = texto;
    Object.assign(toast.style, {
      position: "fixed", right: "18px", bottom: "18px", zIndex: "99999",
      padding: "13px 17px", borderRadius: "9px", color: "#fff",
      background: tipo === "error" ? "#b42318" : "#18794e",
      boxShadow: "0 8px 28px #0008", maxWidth: "min(420px, calc(100vw - 36px))",
    });
    document.body.appendChild(toast);
    window.setTimeout(() => toast.remove(), 3500);
  }

  async function requisicao(url, opcoes = {}) {
    const resposta = await fetch(url, {
      credentials: "same-origin",
      cache: "no-store",
      ...opcoes,
      headers: {
        Accept: "application/json",
        ...(opcoes.body ? { "Content-Type": "application/json" } : {}),
        ...(opcoes.headers || {}),
      },
    });
    const dados = await resposta.json().catch(() => ({}));
    if (resposta.status === 401 || resposta.status === 403) {
      window.location.replace(LOGIN);
      throw new Error("Sessão inválida ou sem permissão.");
    }
    if (!resposta.ok) {
      throw new Error(dados.mensagem || "Não foi possível concluir a operação.");
    }
    return dados;
  }

  function formatarData(valor) {
    if (!valor) return "—";
    const texto = String(valor);
    const match = texto.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
    const data = match
      ? new Date(+match[1], +match[2] - 1, +match[3], +match[4], +match[5])
      : new Date(valor);
    return Number.isNaN(data.getTime()) ? "—" : data.toLocaleDateString("pt-BR");
  }

  async function autenticar() {
    const dados = await requisicao(`${API_AUTH}/me`);
    const usuario = dados.usuario;
    if (!usuario || usuario.tipo !== "admin") {
      window.location.replace(LOGIN);
      return false;
    }
    const nome = usuario.nome || "Administrador";
    if (el.userName) el.userName.textContent = nome;
    if (el.avatar) el.avatar.textContent = nome.trim().charAt(0).toUpperCase() || "A";
    if (el.dropdownName) el.dropdownName.textContent = nome;
    if (el.dropdownRole) el.dropdownRole.textContent = "Administrador";
    return true;
  }

  function mostrarEstado(texto) {
    if (!el.tbody) return;
    el.tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4">${escapar(texto)}</td></tr>`;
  }

  function renderizar() {
    if (!el.tbody) return;
    if (!usuarios.length) {
      mostrarEstado("Nenhum usuário corresponde aos filtros.");
      el.empty?.classList.remove("hidden");
      if (el.pagination) el.pagination.style.display = "none";
      return;
    }
    el.empty?.classList.add("hidden");
    el.tbody.innerHTML = usuarios.map((u) => {
      const ativo = Number(u.ativo) === 1 || u.ativo === true;
      const proprio = false;
      return `
        <tr>
          <td><strong>${escapar(u.nome)}</strong></td>
          <td>${escapar(u.email)}</td>
          <td><span class="badge badge-info">${escapar(PERFIS[u.tipo] || u.tipo)}</span></td>
          <td>${escapar(formatarData(u.data_cadastro))}</td>
          <td><span class="badge badge-info" style="color:${ativo ? "#86efac" : "#fca5a5"};border-color:${ativo ? "#166534" : "#7f1d1d"};background:${ativo ? "rgba(34,197,94,.12)" : "rgba(248,113,113,.12)"}">${ativo ? "Ativo" : "Inativo"}</span></td>
          <td>
            <div class="acoes" style="display:flex;flex-wrap:wrap;gap:6px">
              <button type="button" class="btn btn-secondary" data-acao="editar" data-id="${Number(u.id)}">Editar</button>
              <button type="button" class="btn ${ativo ? "btn-secondary" : "btn-primary"}" data-acao="status" data-id="${Number(u.id)}">${ativo ? "Desativar" : "Ativar"}</button>
            </div>
          </td>
        </tr>
      `;
    }).join("");
    if (el.pagination) el.pagination.style.display = "none";
  }

  async function carregarUsuarios() {
    mostrarEstado("Carregando usuários...");
    const params = new URLSearchParams();
    if (el.busca?.value.trim()) params.set("busca", el.busca.value.trim());
    if (el.perfil?.value) params.set("perfil", el.perfil.value);
    if (el.ativo?.value) params.set("ativo", el.ativo.value);
    try {
      const query = params.toString();
      const dados = await requisicao(query ? `${API}?${query}` : API);
      usuarios = Array.isArray(dados.usuarios) ? dados.usuarios : [];
      renderizar();
    } catch (erro) {
      console.error("[Gestão de usuários]", erro);
      mostrarEstado(erro.message);
      mensagem(erro.message, "error");
    }
  }

  function abrirModal(usuario = null) {
    el.form?.reset();
    el.id.value = usuario?.id || "";
    el.nome.value = usuario?.nome || "";
    el.email.value = usuario?.email || "";
    el.perfilForm.value = usuario?.tipo || "";
    el.ativoForm.checked = usuario ? (Number(usuario.ativo) === 1 || usuario.ativo === true) : true;
    el.senha.value = "";
    el.confirmar.value = "";
    el.senha.required = !usuario;
    el.confirmar.required = !usuario;
    if (el.confirmarGroup) el.confirmarGroup.style.display = usuario ? "none" : "";
    if (el.senhaGroup) {
      const label = el.senhaGroup.querySelector("label");
      if (label) label.textContent = usuario ? "Nova senha (opcional)" : "Senha *";
      const help = $("senhaHelp");
      if (help) help.textContent = usuario ? "Deixe em branco para manter a senha atual." : "Mínimo 8 caracteres";
    }
    el.modalTitulo.textContent = usuario ? "Editar usuário" : "Novo usuário";
    el.btnSalvar.textContent = usuario ? "Salvar alterações" : "Criar usuário";
    el.modal.classList.remove("hidden");
    el.modal.classList.add("show");
    el.modal.setAttribute("aria-hidden", "false");
    el.nome.focus();
  }

  function fecharModal() {
    el.modal?.classList.remove("show");
    el.modal?.classList.add("hidden");
    el.modal?.setAttribute("aria-hidden", "true");
  }

  async function salvarUsuario(evento) {
    evento.preventDefault();
    if (salvando) return;

    const editando = Boolean(el.id.value);
    const senha = el.senha.value;
    if (!editando && senha !== el.confirmar.value) {
      mensagem("As senhas não coincidem.", "error");
      el.confirmar.focus();
      return;
    }
    if (senha && senha !== el.confirmar.value && editando) {
      mensagem("Confirme a nova senha no campo de confirmação.", "error");
      // O campo de confirmação é exibido quando a senha de edição é preenchida.
      if (el.confirmarGroup) el.confirmarGroup.style.display = "";
      el.confirmar.required = true;
      el.confirmar.focus();
      return;
    }

    const payload = {
      nome: el.nome.value.trim(),
      email: el.email.value.trim(),
      perfil: el.perfilForm.value,
      ativo: el.ativoForm.checked,
    };
    if (senha) payload.senha = senha;

    salvando = true;
    el.btnSalvar.disabled = true;
    try {
      await requisicao(editando ? `${API}/${encodeURIComponent(el.id.value)}` : API, {
        method: editando ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });
      mensagem(editando ? "Usuário atualizado." : "Usuário criado.");
      fecharModal();
      await carregarUsuarios();
    } catch (erro) {
      mensagem(erro.message, "error");
    } finally {
      salvando = false;
      el.btnSalvar.disabled = false;
    }
  }

  async function alternarStatus(id) {
    const usuario = usuarios.find((item) => Number(item.id) === Number(id));
    if (!usuario) return;
    const ativo = !(Number(usuario.ativo) === 1 || usuario.ativo === true);
    const acao = ativo ? "ativar" : "desativar";
    if (!window.confirm(`Deseja realmente ${acao} o acesso de ${usuario.nome}?`)) return;
    try {
      await requisicao(`${API}/${encodeURIComponent(id)}`, {
        method: "PUT",
        body: JSON.stringify({
          nome: usuario.nome,
          email: usuario.email,
          perfil: usuario.tipo,
          ativo,
        }),
      });
      mensagem(`Acesso ${ativo ? "ativado" : "desativado"} com sucesso.`);
      await carregarUsuarios();
    } catch (erro) {
      mensagem(erro.message, "error");
    }
  }

  el.tbody?.addEventListener("click", (evento) => {
    const botao = evento.target.closest("button[data-acao]");
    if (!botao) return;
    const id = Number(botao.dataset.id);
    const usuario = usuarios.find((item) => Number(item.id) === id);
    if (botao.dataset.acao === "editar" && usuario) abrirModal(usuario);
    if (botao.dataset.acao === "status") alternarStatus(id);
  });

  el.btnNovo?.addEventListener("click", () => abrirModal());
  el.btnPrimeiro?.addEventListener("click", () => abrirModal());
  el.btnCancelar?.addEventListener("click", fecharModal);
  el.btnFechar?.addEventListener("click", fecharModal);
  el.form?.addEventListener("submit", salvarUsuario);

  el.busca?.addEventListener("input", () => {
    window.clearTimeout(temporizadorBusca);
    temporizadorBusca = window.setTimeout(carregarUsuarios, 300);
  });
  el.perfil?.addEventListener("change", carregarUsuarios);
  el.ativo?.addEventListener("change", carregarUsuarios);

  function alternarVisibilidade(campo, botao) {
    botao?.addEventListener("click", () => {
      const mostrar = campo.type === "password";
      campo.type = mostrar ? "text" : "password";
      botao.setAttribute("aria-pressed", String(mostrar));
      botao.setAttribute("aria-label", mostrar ? "Ocultar senha" : "Mostrar senha");
    });
  }
  alternarVisibilidade(el.senha, el.toggleSenha);
  alternarVisibilidade(el.confirmar, el.toggleConfirmar);

  el.senha?.addEventListener("input", () => {
    if (el.id.value && el.senha.value && el.confirmarGroup) {
      el.confirmarGroup.style.display = "";
      el.confirmar.required = true;
    } else if (el.id.value && !el.senha.value && el.confirmarGroup) {
      el.confirmarGroup.style.display = "none";
      el.confirmar.required = false;
      el.confirmar.value = "";
    }
  });

  el.userButton?.addEventListener("click", (evento) => {
    evento.stopPropagation();
    const aberto = el.dropdown.classList.toggle("show");
    el.userButton.setAttribute("aria-expanded", String(aberto));
  });
  document.addEventListener("click", (evento) => {
    if (el.userMenu && !el.userMenu.contains(evento.target)) {
      el.dropdown?.classList.remove("show");
      el.userButton?.setAttribute("aria-expanded", "false");
    }
  });
  el.navToggle?.addEventListener("click", () => {
    const aberto = el.nav.classList.toggle("show");
    el.navToggle.setAttribute("aria-expanded", String(aberto));
  });
  el.logout?.addEventListener("click", async () => {
    try { await requisicao(`${API_AUTH}/logout`, { method: "POST" }); }
    finally { window.location.replace(LOGIN); }
  });

  (async () => {
    try {
      if (await autenticar()) await carregarUsuarios();
    } catch (erro) {
      console.error("[Gestão de usuários] Falha na inicialização:", erro);
      window.location.replace(LOGIN);
    }
  })();
});
