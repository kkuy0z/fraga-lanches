const formLogin = document.getElementById("form-login");

if (formLogin) {
    formLogin.addEventListener("submit", async (event) => {
        event.preventDefault();

        limparErrosLogin();

        const email = formLogin.elements.namedItem("email").value.trim();
        const senha = formLogin.elements.namedItem("senha").value;
        const lembrar = formLogin.elements.namedItem("lembrar")?.checked || false;

        if (!email) {
            mostrarErroLogin("erro-email", "Informe seu e-mail.");
            return;
        }

        if (!senha) {
            mostrarErroLogin("erro-senha", "Informe sua senha.");
            return;
        }

        const botao = formLogin.querySelector('[type="submit"]');
        botao.disabled = true;

        try {
            const resposta = await fetch("/api/auth/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                credentials: "same-origin",
                body: JSON.stringify({
                    email,
                    senha,
                    lembrar
                })
            });

            const dados = await resposta.json();

            if (!resposta.ok) {
                mostrarErroLogin(
                    "erro-senha",
                    dados.mensagem || "Não foi possível entrar."
                );
                return;
            }

            const sucesso = document.getElementById("sucesso");

            if (sucesso) {
                sucesso.textContent = dados.mensagem;
                sucesso.classList.remove("hidden");
            }

            const destinos = {
    cliente: "/cliente/painel.html",
    cozinha: "/cozinha/painel.html",
    entregador: "/entregador/painel.html",
    atendente: "/atendente/painel.html",
    admin: "/admin/admin-dashboard.html"
};

const destino = destinos[dados.usuario.tipo];

if (destino) {
    window.location.href = destino;
} else {
    mostrarErroLogin(
        "erro-email",
        "Tipo de usuÃ¡rio nÃ£o reconhecido."
    );
}

        } catch (erro) {
            mostrarErroLogin(
                "erro-email",
                "Não foi possível conectar ao servidor."
            );
        } finally {
            botao.disabled = false;
        }
    });
}

function mostrarErroLogin(id, mensagem) {
    const elemento = document.getElementById(id);

    if (elemento) {
        elemento.textContent = mensagem;
        elemento.classList.remove("hidden");
    }
}

function limparErrosLogin() {
    ["erro-email", "erro-senha", "erro-lembrar"].forEach((id) => {
        const elemento = document.getElementById(id);

        if (elemento) {
            elemento.textContent = "";
            elemento.classList.add("hidden");
        }
    });

    const sucesso = document.getElementById("sucesso");

    if (sucesso) {
        sucesso.classList.add("hidden");
    }
}