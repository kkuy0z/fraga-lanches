"use strict";

// ======================================================
// CONFIGURAÇÕES
// ======================================================

const API_AUTH = "/api/auth";
const URL_DASHBOARD = "/admin/admin-dashboard.html";

// ======================================================
// ELEMENTOS
// ======================================================

const formLogin = document.getElementById("formLogin");
const campoEmail = document.getElementById("email");
const campoSenha = document.getElementById("senha");
const lembrar = document.getElementById("lembrar");
const btnLogin = document.getElementById("btnLogin");
const toggleSenha = document.getElementById("toggleSenha");
const mensagemLogin = document.getElementById("mensagemLogin");

// ======================================================
// MENSAGENS
// ======================================================

function exibirMensagem(mensagem, erro = true) {
  if (!mensagemLogin) return;

  mensagemLogin.textContent = mensagem;

  mensagemLogin.style.color = erro ? "#dc3545" : "#198754";
}

// ======================================================
// BOTÃO DE CARREGAMENTO
// ======================================================

function alterarEstadoBotao(carregando) {
  if (!btnLogin) return;

  btnLogin.disabled = carregando;

  btnLogin.textContent = carregando ? "Entrando..." : "Entrar";
}

// ======================================================
// REQUISIÇÕES
// ======================================================

async function requisicao(url, opcoes = {}) {
  const resposta = await fetch(url, {
    credentials: "same-origin",
    ...opcoes,
    headers: {
      ...(opcoes.headers || {}),
    },
  });

  const dados = await resposta.json().catch(() => ({}));

  if (!resposta.ok) {
    const erro = new Error(
      dados.mensagem || "Não foi possível realizar a operação.",
    );

    erro.status = resposta.status;

    throw erro;
  }

  return dados;
}

// ======================================================
// VERIFICAR SESSÃO EXISTENTE
// ======================================================

async function verificarSessaoExistente() {
  try {
    const dados = await requisicao(`${API_AUTH}/me`);

    const usuario = dados.usuario;

    if (usuario && usuario.tipo === "admin") {
      window.location.replace(URL_DASHBOARD);
      return true;
    }

    if (usuario) {
      exibirMensagem(
        "Você está conectado com uma conta de cliente. Entre com uma conta administrativa.",
      );
    }

    return false;
  } catch (erro) {
    // Sem sessão válida: permanece na tela de login.
    if (erro.status !== 401) {
      console.error("Erro ao verificar sessão:", erro);
    }

    return false;
  }
}

// ======================================================
// MOSTRAR / OCULTAR SENHA
// ======================================================

if (toggleSenha && campoSenha) {
  toggleSenha.addEventListener("click", () => {
    const mostrar = campoSenha.type === "password";

    campoSenha.type = mostrar ? "text" : "password";

    toggleSenha.setAttribute(
      "aria-label",
      mostrar ? "Ocultar senha" : "Mostrar senha",
    );

    toggleSenha.setAttribute("aria-pressed", String(mostrar));
  });
}

// ======================================================
// LOGIN ADMINISTRATIVO
// ======================================================

if (formLogin) {
  formLogin.addEventListener("submit", async (event) => {
    event.preventDefault();

    exibirMensagem("");

    if (!formLogin.checkValidity()) {
      formLogin.reportValidity();
      return;
    }

    const email = campoEmail.value.trim();
    const senha = campoSenha.value;

    if (!email || !senha) {
      exibirMensagem("Informe seu e-mail e sua senha.");
      return;
    }

    alterarEstadoBotao(true);

    try {
      // 1. Autenticar usuário.
      await requisicao(`${API_AUTH}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          senha,
          lembrar: Boolean(lembrar?.checked),
        }),
      });

      // 2. Validar a sessão criada pelo backend.
      const dadosSessao = await requisicao(`${API_AUTH}/me`);

      const usuario = dadosSessao.usuario;

      // 3. Bloquear acesso de contas que não são administrativas.
      if (!usuario || usuario.tipo !== "admin") {
        exibirMensagem("Acesso negado. Esta conta não é de administrador.");

        // Não encerramos a sessão do cliente.
        alterarEstadoBotao(false);
        return;
      }

      // 4. Redirecionar para o dashboard.
      exibirMensagem("Login realizado com sucesso. Redirecionando...", false);

      window.location.replace(URL_DASHBOARD);
    } catch (erro) {
      console.error("Erro no login administrativo:", erro);

      exibirMensagem(erro.message || "Não foi possível realizar o login.");

      alterarEstadoBotao(false);
    }
  });
}

// ======================================================
// INICIALIZAÇÃO
// ======================================================

async function iniciarLogin() {
  if (!formLogin) {
    console.error("Formulário de login não encontrado.");
    return;
  }

  await verificarSessaoExistente();
}

iniciarLogin();
