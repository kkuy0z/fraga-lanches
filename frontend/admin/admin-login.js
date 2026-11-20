const formLogin = document.getElementById("formLogin");
const campoEmail = document.getElementById("email");
const campoSenha = document.getElementById("senha");
const lembrar = document.getElementById("lembrar");
const btnLogin = document.getElementById("btnLogin");
const toggleSenha = document.getElementById("toggleSenha");
const mensagemLogin = document.getElementById("mensagemLogin");

function exibirMensagem(mensagem, erro = true) {
  mensagemLogin.textContent = mensagem;
  mensagemLogin.style.color = erro ? "#dc3545" : "#198754";
}

if (toggleSenha) {
  toggleSenha.addEventListener("click", () => {
    const mostrar = campoSenha.type === "password";

    campoSenha.type = mostrar ? "text" : "password";

    toggleSenha.setAttribute(
      "aria-label",
      mostrar ? "Ocultar senha" : "Mostrar senha",
    );
  });
}

formLogin.addEventListener("submit", async (event) => {
  event.preventDefault();

  exibirMensagem("");

  if (!formLogin.checkValidity()) {
    formLogin.reportValidity();
    return;
  }

  const email = campoEmail.value.trim();
  const senha = campoSenha.value;

  btnLogin.disabled = true;
  btnLogin.textContent = "Entrando...";

  try {
    const resposta = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "same-origin",
      body: JSON.stringify({
        email,
        senha,
        lembrar: lembrar.checked,
      }),
    });

    const dados = await resposta.json().catch(() => ({}));

    if (!resposta.ok) {
      throw new Error(dados.mensagem || "E-mail ou senha incorretos.");
    }

    // Confirma o perfil usando a sessão criada pelo backend.
    const respostaUsuario = await fetch("/api/auth/me", {
      method: "GET",
      credentials: "same-origin",
    });

    if (!respostaUsuario.ok) {
      throw new Error("Não foi possível validar sua sessão.");
    }

    const dadosUsuario = await respostaUsuario.json();
    const usuario = dadosUsuario.usuario;

    if (!usuario || usuario.tipo !== "admin") {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });

      throw new Error("Acesso negado. Esta conta não é de administrador.");
    }

    exibirMensagem("Login realizado. Redirecionando...", false);

    window.location.href = "/admin/admin-dashboard.html";
  } catch (erro) {
    console.error("Erro no login administrativo:", erro);

    exibirMensagem(erro.message || "Não foi possível realizar o login.");

    btnLogin.disabled = false;
    btnLogin.textContent = "Entrar";
  }
});
