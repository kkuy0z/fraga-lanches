
const API = "http://localhost:8000";

const form = document.getElementById("form-login");
const sucesso = document.getElementById("sucesso");

const email = document.getElementById("email");
const senha = document.getElementById("senha");

const erroEmail = document.getElementById("erro-email");
const erroSenha = document.getElementById("erro-senha");

form.addEventListener("submit", async event => {
    event.preventDefault();

    erroEmail.textContent = "";
    erroSenha.textContent = "";
    sucesso.classList.add("hidden");

    let valido = true;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) {
        erroEmail.textContent = "Digite um e-mail válido.";
        valido = false;
    }

    if (!senha.value) {
        erroSenha.textContent = "Digite sua senha.";
        valido = false;
    }

    if (!valido) return;

    const botao = form.querySelector('button[type="submit"]');
    const textoOriginal = botao.innerHTML;

    botao.disabled = true;
    botao.textContent = "Entrando...";

    try {
        const resposta = await fetch(`${API}/api/auth/login`, {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                email: email.value.trim(),
                senha: senha.value
            })
        });

        const resultado = await resposta.json();

        if (!resposta.ok) {
            throw new Error(resultado.detail || "Não foi possível entrar.");
        }

        sucesso.querySelector("strong").textContent = "Login realizado!";
        sucesso.querySelector("p").textContent =
            `Bem-vindo(a), ${resultado.usuario.nome}!`;

        sucesso.classList.remove("hidden");
        sucesso.focus();

        setTimeout(() => {
            window.location.href = "/inicio/index.html";
        }, 1000);

    } catch (erro) {
        erroSenha.textContent =
            erro.message || "Não foi possível conectar ao servidor.";
    } finally {
        botao.disabled = false;
        botao.innerHTML = textoOriginal;
    }
});

// Mostrar e ocultar senha
document.querySelectorAll("[data-alvo]").forEach(botao => {
    botao.addEventListener("click", () => {
        const campo = document.getElementById(botao.dataset.alvo);
        const mostrar = campo.type === "password";

        campo.type = mostrar ? "text" : "password";
        botao.setAttribute("aria-pressed", String(mostrar));
        botao.setAttribute(
            "aria-label",
            mostrar ? "Ocultar senha" : "Mostrar senha"
        );
    });
});
