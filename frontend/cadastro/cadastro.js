
const API = "http://localhost:8000";

const form = document.getElementById("form-cadastro");
const sucesso = document.getElementById("sucesso");

const campos = {
    nome: document.getElementById("nome"),
    email: document.getElementById("email"),
    telefone: document.getElementById("telefone"),
    senha: document.getElementById("senha"),
    confirmar: document.getElementById("confirmar"),
    termos: document.getElementById("termos")
};

const erros = {
    nome: document.getElementById("erro-nome"),
    email: document.getElementById("erro-email"),
    telefone: document.getElementById("erro-telefone"),
    senha: document.getElementById("erro-senha"),
    confirmar: document.getElementById("erro-confirmar"),
    termos: document.getElementById("erro-termos")
};

function mostrarErro(campo, mensagem = "") {
    erros[campo].textContent = mensagem;
}

function limparErros() {
    Object.keys(erros).forEach(campo => mostrarErro(campo));
}

function validarFormulario() {
    limparErros();

    let valido = true;

    const nome = campos.nome.value.trim();
    const email = campos.email.value.trim();
    const telefone = campos.telefone.value.replace(/\D/g, "");
    const senha = campos.senha.value;
    const confirmar = campos.confirmar.value;

    if (nome.length < 3) {
        mostrarErro("nome", "Digite seu nome completo.");
        valido = false;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        mostrarErro("email", "Digite um e-mail válido.");
        valido = false;
    }

    if (![10, 11].includes(telefone.length)) {
        mostrarErro("telefone", "Digite um telefone válido.");
        valido = false;
    }

    if (senha.length < 8) {
        mostrarErro("senha", "A senha precisa ter pelo menos 8 caracteres.");
        valido = false;
    }

    if (senha !== confirmar) {
        mostrarErro("confirmar", "As senhas não são iguais.");
        valido = false;
    }

    if (!campos.termos.checked) {
        mostrarErro("termos", "Você precisa aceitar os termos.");
        valido = false;
    }

    return valido;
}

form.addEventListener("submit", async event => {
    event.preventDefault();

    sucesso.classList.add("hidden");

    if (!validarFormulario()) return;

    const botao = form.querySelector('button[type="submit"]');
    const textoOriginal = botao.innerHTML;

    botao.disabled = true;
    botao.textContent = "Criando conta...";

    try {
        const resposta = await fetch(`${API}/api/auth/cadastro`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                nome: campos.nome.value.trim(),
                email: campos.email.value.trim(),
                telefone: campos.telefone.value,
                senha: campos.senha.value,
                termos: campos.termos.checked
            })
        });

        const resultado = await resposta.json();

        if (!resposta.ok) {
            throw new Error(resultado.detail || "Não foi possível realizar o cadastro.");
        }

        sucesso.querySelector("strong").textContent = "Conta criada!";
        sucesso.querySelector("p").textContent =
            "Seu cadastro foi salvo. Agora você já pode entrar na sua conta.";

        sucesso.classList.remove("hidden");
        sucesso.focus();

        form.reset();

        setTimeout(() => {
            window.location.href = "/Cadastro/login.html";
        }, 1800);

    } catch (erro) {
        if (erro.message.toLowerCase().includes("e-mail")) {
            mostrarErro("email", erro.message);
        } else {
            alert(erro.message || "Não foi possível conectar ao servidor.");
        }
    } finally {
        botao.disabled = false;
        botao.innerHTML = textoOriginal;
    }
});

// Mostrar e ocultar senhas
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
